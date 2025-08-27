document.getElementById('prompt-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  generateImages();
});

document.getElementById('regenerate-btn').addEventListener('click', async () => {
  generateImages();
});

document.getElementById('save-story-btn').addEventListener('click', () => {
  alert('Câu chuyện đã được lưu thành công!');
  // In a real app, you would implement actual saving functionality here
});

document.getElementById('tts-btn').addEventListener('click', async () => {
    const prompt = document.getElementById('prompt').value;
    
    if (!prompt) {
        showError('Vui lòng nhập câu chuyện trước');
        return;
    }
    
    // Show loading state
    const loading = document.getElementById('loading');
    const originalText = loading.textContent;
    loading.classList.remove('hidden');
    loading.textContent = 'Đang tạo giọng nói...';
    
    try {
        const response = await fetch('/tts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                text: prompt,
                voice: document.getElementById('voice-select').value 
            }),
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Tạo giọng nói thất bại');
        }
        
        // Create an audio element and play the response
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.play();
    } catch (error) {
        console.error('TTS error:', error);
        showError(`Lỗi: ${error.message}`);
    } finally {
        loading.classList.add('hidden');
        loading.textContent = originalText;
    }
});

async function generateImages() {
  const prompt = document.getElementById('prompt').value;
  const steps = document.getElementById('steps').value;
  const numImages = document.getElementById('num-images').value;
  
  const loading = document.getElementById('loading');
  const result = document.getElementById('result');
  const storyControls = document.getElementById('story-controls');
  
  loading.classList.remove('hidden');
  result.innerHTML = '';
  storyControls.classList.add('hidden');
  
  try {
    console.log('Sending request to generate images...');
    const response = await fetch('/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        prompt, 
        steps: parseInt(steps),
        numImages: parseInt(numImages)
      }),
    });
    
    console.log('Response status:', response.status);
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Server error:', errorData);
      throw new Error(errorData.error || `Server responded with status ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Received image URLs:', data.imageUrls);
    
    if (data.imageUrls && data.imageUrls.length > 0) {
      const imageGrid = document.createElement('div');
      imageGrid.className = 'image-grid';
      
      data.imageUrls.forEach((url, index) => {
        const imageContainer = document.createElement('div');
        imageContainer.className = 'image-container';
        
        const img = document.createElement('img');
        img.src = url;
        img.alt = `Hình ảnh câu chuyện ${index + 1}`;
        
        const caption = document.createElement('div');
        caption.className = 'caption';
        caption.textContent = `Cảnh ${index + 1}`;
        
        imageContainer.appendChild(img);
        imageContainer.appendChild(caption);
        imageGrid.appendChild(imageContainer);
      });
      
      result.appendChild(imageGrid);
      storyControls.classList.remove('hidden');
      
      // Show warning if some images failed to generate
      if (data.warning) {
        const warningDiv = document.createElement('div');
        warningDiv.className = 'warning';
        warningDiv.textContent = data.warning;
        result.appendChild(warningDiv);
      }
    } else {
      result.innerHTML = '<div class="error">Không tạo được hình ảnh. Vui lòng thử lại.</div>';
    }
  } catch (error) {
    console.error('Error:', error);
    result.innerHTML = `<div class="error">Lỗi: ${error.message}</div>`;
  } finally {
    loading.classList.add('hidden');
  }
}

function showError(message) {
  const result = document.getElementById('result');
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error';
  errorDiv.textContent = message;
  result.appendChild(errorDiv);
  
  // Remove error after 5 seconds
  setTimeout(() => {
    errorDiv.remove();
  }, 5000);
}