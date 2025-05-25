export class Narrator {
    constructor() {
        this.isPlaying = false;
        this.currentAudio = null;
        this.voiceSettings = {
            type: 'en-female',
            customFile: null
        };
    }
    
    setVoiceSettings(voiceSettings) {
        this.voiceSettings = voiceSettings;
    }
    
    async narrate(text) {
        // Stop any current narration
        this.stop();
        
        this.isPlaying = true;
        
        try {
            let result;
            
            if (this.voiceSettings.type === 'custom' && this.voiceSettings.customFile) {
                // Convert file to data URL for voice cloning
                const fileDataUrl = await this.fileToDataUrl(this.voiceSettings.customFile);
                
                result = await websim.textToSpeech({
                    text: text,
                    voice_sample: fileDataUrl
                });
            } else {
                result = await websim.textToSpeech({
                    text: text,
                    voice: this.voiceSettings.type
                });
            }
            
            this.currentAudio = new Audio(result.url);
            
            // Set up event listeners
            this.currentAudio.addEventListener('ended', () => {
                this.isPlaying = false;
                this.currentAudio = null;
            });
            
            this.currentAudio.addEventListener('error', (e) => {
                console.error('Audio playback error:', e);
                this.isPlaying = false;
                this.currentAudio = null;
            });
            
            // Play the audio
            await this.currentAudio.play();
            
        } catch (error) {
            console.error('Text-to-speech error:', error);
            this.isPlaying = false;
            throw error;
        }
    }
    
    fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }
        this.isPlaying = false;
    }
    
    pause() {
        if (this.currentAudio && !this.currentAudio.paused) {
            this.currentAudio.pause();
            this.isPlaying = false;
        }
    }
    
    resume() {
        if (this.currentAudio && this.currentAudio.paused) {
            this.currentAudio.play();
            this.isPlaying = true;
        }
    }
}