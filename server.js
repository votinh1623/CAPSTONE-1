const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const app = express();
const port = 3000;

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// Create generated directory if it doesn't exist
const generatedDir = path.join(__dirname, 'public', 'generated');
if (!fs.existsSync(generatedDir)) {
  fs.mkdirSync(generatedDir, { recursive: true });
}

// Image generation endpoint
app.post('/generate', (req, res) => {
  const prompt = req.body.prompt;
  const steps = req.body.steps || 20;
  const numImages = req.body.numImages || 4; // Default to 4 images if not specified
  
  console.log(`Generating ${numImages} images for prompt: "${prompt}" with ${steps} steps`);
  
  const python = spawn('python', ['generate.py', prompt, steps.toString(), numImages.toString()]);
  
  let output = '';
  let error = '';
  
  python.stdout.on('data', (data) => {
    output += data.toString();
    console.log(`Python stdout: ${data.toString()}`);
  });
  
  python.stderr.on('data', (data) => {
    error += data.toString();
    console.error(`Python stderr: ${data.toString()}`);
  });
  
  python.on('close', (code) => {
    console.log(`Python process exited with code ${code}`);
    
    if (code !== 0) {
      console.error(`Python process exited with code ${code}`);
      console.error(`Error output: ${error}`);
      return res.status(500).json({ error: 'Image generation failed', details: error });
    }
    
    // Get the last line of output which should be JSON
    const lines = output.trim().split('\n');
    console.log(`Python output lines: ${lines.length}`);
    
    // Find the last non-empty line
    let lastLine = '';
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim() !== '') {
        lastLine = lines[i];
        break;
      }
    }
    
    console.log(`Last line of output: ${lastLine}`);
    
    let filenames;
    try {
      filenames = JSON.parse(lastLine);
    } catch (e) {
      console.error('Failed to parse JSON from Python output:', lastLine);
      console.error('Full output:', output);
      return res.status(500).json({ error: 'Invalid response from image generation', details: output });
    }
    
    if (!Array.isArray(filenames)) {
      console.error('Expected an array of filenames, got:', filenames);
      return res.status(500).json({ error: 'Invalid response from image generation', details: filenames });
    }
    
    console.log(`Generated images: ${filenames.join(', ')}`);
    
    // Verify all files exist and create URLs
    const imageUrls = [];
    const missingFiles = [];
    
    filenames.forEach(filename => {
      const filepath = path.join(generatedDir, filename);
      if (fs.existsSync(filepath)) {
        imageUrls.push(`/generated/${filename}`);
      } else {
        missingFiles.push(filename);
      }
    });
    
    if (missingFiles.length > 0) {
      console.error(`Generated files not found: ${missingFiles.join(', ')}`);
      // If some files were generated, return those with a warning
      if (imageUrls.length > 0) {
        return res.status(206).json({ 
          imageUrls,
          warning: `Some images failed to generate: ${missingFiles.join(', ')}`
        });
      } else {
        return res.status(500).json({ error: 'Generated image files not found', details: missingFiles });
      }
    }
    
    res.json({ imageUrls });
  });
});

// TTS endpoint
app.post('/tts', async (req, res) => {
    const text = req.body.text;
    const voice = req.body.voice || 'vi-VN-HoaiMyNeural';
    
    console.log(`TTS request: voice=${voice}, text=${text.substring(0, 50)}...`);
    
    if (!text) {
        return res.status(400).json({ error: 'No text provided' });
    }
    
    try {
        // Forward the request to the TTS server
        const ttsResponse = await fetch('http://localhost:5001/tts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text, voice }),
        });
        
        if (!ttsResponse.ok) {
            const errorText = await ttsResponse.text();
            console.error(`TTS server error: ${errorText}`);
            throw new Error(`TTS server error: ${errorText}`);
        }
        
        // Set the appropriate headers
        res.setHeader('Content-Type', ttsResponse.headers.get('Content-Type') || 'audio/mpeg');
        res.setHeader('Content-Disposition', ttsResponse.headers.get('Content-Disposition') || 'attachment; filename=speech.mp3');
        
        // Convert web stream to Node.js stream and pipe
        if (ttsResponse.body) {
            // For Node.js v17.5.0 and above
            const nodeStream = Readable.fromWeb(ttsResponse.body);
            nodeStream.pipe(res);
        } else {
            throw new Error('No response body from TTS server');
        }
    } catch (error) {
        console.error('TTS proxy error:', error);
        res.status(500).json({ error: 'TTS generation failed', details: error.message });
    }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});