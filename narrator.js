export class Narrator {
    constructor() {
        this.isPlaying = false;
        this.currentAudio = null;
    }
    
    async narrate(text) {
        // Stop any current narration
        this.stop();
        
        this.isPlaying = true;
        
        try {
            const result = await websim.textToSpeech({
                text: text,
                voice: "en-female"
            });
            
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

