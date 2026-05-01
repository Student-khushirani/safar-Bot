require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname)));

// ─── SafarBot System Prompt ──────────────────────────────────────────────────
const SAFARBOT_PROMPT = `You are "SafarBot" – an AI travel assistant for India & Asia.

FLOW:
1. When user mentions a destination, ASK 3-4 questions first: budget, days, who's traveling, interests
2. After they answer, CONFIRM the plan briefly
3. Then give the FULL travel plan

EXCEPTION: "Surprise me" → suggest 2-3 destinations, ask which to plan.

FULL PLAN FORMAT (Step 3 only):
## 🌍 Destination – Brief intro
## 📅 Best Time – best/worst months
## 🌦 Weather – conditions, temp range
## 🎯 Top Things To Do – 8-10 attractions + hidden gems
## 📍 Nearby Places – day trips
## 💰 Budget – accommodation, food, transport, total ₹ estimate
## 🏨 Hotels – 3-4 real names with prices
## 🚗 How to Reach – flights, trains, buses with costs
## 🚕 Local Transport – cabs, autos, rentals
## 🛡 Safety – level (Safe/Moderate/Risky), tips for their group
## 📞 Emergency Contacts – police, ambulance, tourist helpline
## 🎒 Packing List – based on weather & trip type
## ✅ Do's & Don'ts

RULES:
- Use markdown headers (##), bold, bullet points, emojis
- Be specific: real hotel names, real prices in ₹
- Keep responses structured and scannable
- Cover all Indian states + Asian countries
- Include visa info for international trips
- End with: *✨ Want me to customize further?*
`;

// ─── Gemini AI Setup ─────────────────────────────────────────────────────────
const { GoogleGenerativeAI } = require('@google/generative-ai');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let genAI = null;
let aiModel = null;

if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  aiModel = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: SAFARBOT_PROMPT
  });
  console.log('✅ Gemini API key found – using gemini-1.5-flash');
} else {
  console.warn('⚠️  No Gemini API key found. Chat will return an error message.');
}

// ─── Conversation Storage (in-memory) ───────────────────────────────────────
const conversations = new Map();

// ─── Chat Endpoint ───────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || !sessionId) {
      return res.status(400).json({ error: 'Missing message or sessionId' });
    }

    if (!GEMINI_API_KEY || !aiModel) {
      return res.json({
        reply: `## ⚠️ API Key Required\n\nSafarBot needs a **Gemini API key** to work.\n\n**How to set it up:**\n1. Go to [Google AI Studio](https://aistudio.google.com/)\n2. Create an API key\n3. Add it to your Vercel Environment Variables as GEMINI_API_KEY\n4. Redeploy or restart the server\n\n*It's completely free! 🎉*`,
      });
    }

    // Get or create conversation history
    if (!conversations.has(sessionId)) {
      conversations.set(sessionId, []);
    }
    const history = conversations.get(sessionId);

    // Build history for Gemini
    const geminiHistory = history.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const chat = aiModel.startChat({
      history: geminiHistory,
    });

    const result = await chat.sendMessage(message);
    const reply = result.response.text();

    // Save to history
    history.push({ role: 'user', content: message });
    history.push({ role: 'assistant', content: reply });

    // Keep history manageable (last 30 messages)
    if (history.length > 30) {
      conversations.set(sessionId, history.slice(-30));
    }

    res.json({ reply });
  } catch (error) {
    console.error('Chat error:', error.message);

    if (error.message?.includes('API key not valid') || error.message?.includes('401')) {
      return res.json({
        reply: `## ❌ Invalid API Key\n\nThe Gemini API key in your environment variables is invalid.\n\nPlease check your key and update it.`,
      });
    }

    if (error.message?.includes('quota') || error.message?.includes('429')) {
      return res.json({
        reply: `## ⏳ Rate Limited\n\nToo many requests. Please wait a moment and try again.\n\n*The free Gemini API has usage limits.*`,
      });
    }

    res.status(500).json({
      error: 'Something went wrong while connecting to Gemini AI. Please try again.',
    });
  }
});

// ─── Weather API Endpoint (using wttr.in – no API key needed) ───────────────
app.get('/api/weather', async (req, res) => {
  try {
    const city = req.query.city;
    if (!city) return res.status(400).json({ error: 'City parameter required' });

    const response = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
    if (!response.ok) throw new Error('Weather API failed');

    const data = await response.json();
    const current = data.current_condition[0];
    const forecast = data.weather.slice(0, 3);

    res.json({
      city: city,
      current: {
        temp: current.temp_C,
        feelsLike: current.FeelsLikeC,
        humidity: current.humidity,
        wind: current.windspeedKmph,
        description: current.weatherDesc[0].value,
        icon: current.weatherIconUrl?.[0]?.value || '',
        uvIndex: current.uvIndex,
        visibility: current.visibility,
      },
      forecast: forecast.map(day => ({
        date: day.date,
        maxTemp: day.maxtempC,
        minTemp: day.mintempC,
        description: day.hourly[4]?.weatherDesc[0]?.value || '',
        chanceOfRain: day.hourly[4]?.chanceofrain || '0',
      })),
    });
  } catch (error) {
    console.error('Weather error:', error.message);
    res.status(500).json({ error: 'Could not fetch weather data.' });
  }
});

// ─── Clear Session ───────────────────────────────────────────────────────────
app.post('/api/clear', (req, res) => {
  const { sessionId } = req.body;
  if (sessionId) conversations.delete(sessionId);
  res.json({ success: true });
});

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    aiReady: !!GEMINI_API_KEY,
    model: 'gemini-1.5-flash',
    uptime: process.uptime(),
  });
});

// ─── Start Server ────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`\n🚀 SafarBot is running at http://localhost:${PORT}`);
    console.log(`   AI Status: ${GEMINI_API_KEY ? '✅ Ready (gemini-1.5-flash)' : '❌ No API Key'}\n`);
  });
}

module.exports = app;
