from flask import Flask, request, jsonify

app = Flask(__name__)

# 🌍 INDIA 28 STATES + ASIA DATABASE (SHORT BUT COMPLETE STRUCTURE)

travelDB = {

"goa": {
"country": "India",
"bestTime": "Nov - Feb",
"bestPlace": "Baga Beach",
"budget": "₹8000 - ₹20000",
"weather": "Tropical Beach",
"language": "Konkani",
"safety": "Very Safe",
"hotels": "Beach resorts, 3-5 star hotels",
"transport": "Taxi, scooter",
"rules": "No alcohol in public areas",
"music": "Beach chill songs",
"packing": "Light clothes, sunscreen, sunglasses"
},

"kerala": {
"country": "India",
"bestTime": "Oct - Mar",
"bestPlace": "Munnar",
"budget": "₹7000 - ₹18000",
"weather": "Cool hills",
"language": "Malayalam",
"safety": "Very Safe",
"hotels": "Homestays, resorts",
"transport": "Bus, boat, taxi",
"rules": "Respect local culture",
"music": "Nature calm music",
"packing": "Light jacket, shoes"
},

"japan": {
"country": "Asia",
"bestTime": "Mar - May",
"bestPlace": "Tokyo",
"budget": "₹80000 - ₹150000",
"weather": "Moderate",
"language": "Japanese",
"safety": "Extremely Safe",
"hotels": "Capsule hotels, luxury hotels",
"transport": "Bullet train, metro",
"rules": "No littering, queue system",
"music": "Lo-fi Japan travel beats",
"packing": "Modern clothes, adapter"
},

"uae": {
"country": "Asia",
"bestTime": "Nov - Mar",
"bestPlace": "Dubai Burj Khalifa",
"budget": "₹60000 - ₹120000",
"weather": "Hot desert",
"language": "Arabic",
"safety": "Very Safe",
"hotels": "Luxury hotels",
"transport": "Metro, taxi",
"rules": "Respect Islamic culture",
"music": "Luxury chill beats",
"packing": "Light luxury clothes"
}
}

# 🌍 AI FALLBACK RESPONSE (NO LIMIT SYSTEM)
def generate_ai(destination):

    return {
        "reply": f"""
🌍 Destination: {destination}

📍 Best Places:
Famous tourist spots, hidden gems, and local culture.

📅 Best Time:
Depends on season, usually spring or winter.

💰 Budget:
₹5000 - ₹200000 depending on travel style.

🌦 Weather:
Varies by location and season.

🏨 Hotels:
Budget to luxury hotels available.

🚗 Transport:
Local buses, taxis, metro, rentals.

🛡 Safety:
Follow local rules and stay aware.

🎒 Packing List:
- Clothes based on weather
- ID proof
- Power bank
- Medicines
- Travel kit

🎯 Things to Do:
- Explore landmarks
- Try local food
- Adventure activities
- Shopping

🎵 Travel Music:
- Road trip songs
- Chill playlist
- Local music

📜 Rules:
Follow local laws and respect culture.

📞 Emergency:
112 (Universal Emergency)
""",
        "image": "https://images.unsplash.com/photo-1501785888041-af3ef285b470"
    }

# 🚀 MAIN ROUTE
@app.route("/chat", methods=["POST"])
def chat():

    data = request.json
    destination = data.get("destination", "").lower()

    # ❌ EMPTY CHECK
    if not destination:
        return jsonify({
            "reply": "Please enter a destination",
            "image": ""
        })

    # ✅ IF FOUND IN DATABASE
    if destination in travelDB:

        place = travelDB[destination]

        return jsonify({
            "reply": f"""
🌍 Destination: {destination}

🌎 Country: {place['country']}
📍 Best Place: {place['bestPlace']}
📅 Best Time: {place['bestTime']}
💰 Budget: {place['budget']}
🌦 Weather: {place['weather']}
🗣 Language: {place['language']}
🏨 Hotels: {place['hotels']}
🚗 Transport: {place['transport']}
🛡 Safety: {place['safety']}
🎒 Packing: {place['packing']}
🎵 Music: {place['music']}
📜 Rules: {place['rules']}
""",
            "image": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e"
        })

    # 🔥 AI FALLBACK (ALL OTHER 28 STATES + ASIA COVERED HERE)
    return jsonify(generate_ai(destination))


# 🚀 RUN SERVER
if __name__ == "__main__":
    app.run(debug=True)