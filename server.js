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

// ─── Groq AI Setup (Llama 3.1) ─────────────────────────────────────────────
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const AI_MODEL = 'llama-3.1-8b-instant';

if (GROQ_API_KEY) {
  console.log('✅ Groq API key found – using Llama 3.1');
} else {
  console.warn('⚠️  No Groq API key found. Chat will return an error message.');
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

    if (!GROQ_API_KEY) {
      return res.json({
        reply: `## ⚠️ API Key Required\n\nSafarBot needs a **Groq API key** to work.\n\n**How to set it up:**\n1. Go to [Groq Console](https://console.groq.com)\n2. Create a free API key\n3. Add it to your \`.env\` file as GROQ_API_KEY=your_key\n4. Restart the server\n\n*It's completely free! 🎉*`,
      });
    }

    // Get or create conversation history
    if (!conversations.has(sessionId)) {
      conversations.set(sessionId, []);
    }
    const history = conversations.get(sessionId);

    // Build messages array
    const messages = [
      { role: 'system', content: SAFARBOT_PROMPT },
      ...history,
      { role: 'user', content: message },
    ];

    // Call Groq API
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: messages,
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Groq API error:', data);
      throw new Error(data.error?.message || `API error ${response.status}`);
    }

    const reply = data.choices[0].message.content;

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

    if (error.message?.includes('invalid_api_key') || error.message?.includes('401')) {
      return res.json({
        reply: `## ❌ Invalid API Key\n\nThe Groq API key in your \`.env\` file is invalid.\n\nPlease check your key at [Groq Console](https://console.groq.com) and update it.`,
      });
    }

    if (error.message?.includes('rate_limit') || error.message?.includes('429')) {
      return res.json({
        reply: `## ⏳ Rate Limited\n\nToo many requests. Please wait a moment and try again.\n\n*The free Groq API has usage limits.*`,
      });
    }

    res.status(500).json({
      error: 'Something went wrong. Please try again.',
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
    aiReady: !!GROQ_API_KEY,
    model: AI_MODEL,
    uptime: process.uptime(),
  });
});

// ─── Start Server ────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`\n🚀 SafarBot is running at http://localhost:${PORT}`);
    console.log(`   AI Status: ${GROQ_API_KEY ? '✅ Ready (Llama 3.1)' : '❌ No API Key'}\n`);
  });
}

module.exports = app;
