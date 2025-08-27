from flask import Flask, request, make_response
import edge_tts
import asyncio
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

async def generate_speech(text, voice="vi-VN-HoaiMyNeural"):
    logger.info(f"Generating speech with voice: {voice}")
    communicate = edge_tts.Communicate(text, voice)
    audio_data = b""
    
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_data += chunk["data"]
    
    return audio_data

@app.route('/tts', methods=['POST'])
def tts():
    data = request.json
    text = data.get('text', '')
    voice = data.get('voice', 'vi-VN-HoaiMyNeural')
    
    logger.info(f"TTS request received. Text: {text[:50]}..., Voice: {voice}")
    
    if not text:
        logger.error("No text provided in request")
        return {"error": "No text provided"}, 400
    
    try:
        # Generate speech
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        audio_data = loop.run_until_complete(generate_speech(text, voice))
        
        logger.info(f"Generated {len(audio_data)} bytes of audio data")
        
        # Create response directly from audio data
        response = make_response(audio_data)
        response.headers.set('Content-Type', 'audio/mpeg')
        response.headers.set('Content-Disposition', 'attachment; filename=speech.mp3')
        return response
    except Exception as e:
        logger.error(f"Error generating speech: {str(e)}")
        return {"error": str(e)}, 500

if __name__ == '__main__':
    logger.info("Starting Edge TTS server on port 5001")
    app.run(host='0.0.0.0', port=5001, debug=True)