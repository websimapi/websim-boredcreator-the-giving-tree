import { StoryGenerator } from './story.js';
import { Narrator } from './narrator.js';

class GivingTreeApp {
    constructor() {
        this.storyGenerator = new StoryGenerator();
        this.narrator = new Narrator();
        this.currentStory = null;
        this.currentPage = 0;
        this.voiceSettings = {
            type: 'en-female',
            customFile: null
        };
        
        this.initializeElements();
        this.bindEvents();
    }
    
    initializeElements() {
        // Screens
        this.welcomeScreen = document.getElementById('welcome-screen');
        this.storyScreen = document.getElementById('story-screen');
        this.loadingOverlay = document.getElementById('loading-overlay');
        
        // Welcome screen elements
        this.userPrompt = document.getElementById('user-prompt');
        this.generateBtn = document.getElementById('generate-btn');
        
        // Voice selection elements
        this.voiceOptions = document.querySelectorAll('input[name="voice"]');
        this.customVoiceUpload = document.getElementById('custom-voice-upload');
        this.voiceFileInput = document.getElementById('voice-file');
        this.voiceFileName = document.getElementById('voice-file-name');
        
        // Story screen elements
        this.backBtn = document.getElementById('back-btn');
        this.storyTitle = document.getElementById('story-title');
        this.narrateBtn = document.getElementById('narrate-btn');
        this.currentPageEl = document.getElementById('current-page');
        this.totalPagesEl = document.getElementById('total-pages');
        this.pageImage = document.getElementById('page-image');
        this.pageText = document.getElementById('page-text');
        this.prevBtn = document.getElementById('prev-btn');
        this.nextBtn = document.getElementById('next-btn');
        
        // Loading elements
        this.loadingText = document.getElementById('loading-text');
        this.loadingDetails = document.getElementById('loading-details');
    }
    
    bindEvents() {
        this.generateBtn.addEventListener('click', () => this.handleGenerateStory());
        this.userPrompt.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleGenerateStory();
        });
        
        // Voice selection events
        this.voiceOptions.forEach(option => {
            option.addEventListener('change', (e) => this.handleVoiceSelection(e));
        });
        
        this.voiceFileInput.addEventListener('change', (e) => this.handleVoiceFileUpload(e));
        
        this.backBtn.addEventListener('click', () => this.showWelcomeScreen());
        this.narrateBtn.addEventListener('click', () => this.handleNarration());
        this.prevBtn.addEventListener('click', () => this.goToPreviousPage());
        this.nextBtn.addEventListener('click', () => this.goToNextPage());
        
        // Add keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (this.storyScreen.classList.contains('active')) {
                if (e.key === 'ArrowLeft') this.goToPreviousPage();
                if (e.key === 'ArrowRight') this.goToNextPage();
                if (e.key === ' ') {
                    e.preventDefault();
                    this.handleNarration();
                }
            }
        });
    }
    
    handleVoiceSelection(e) {
        const selectedVoice = e.target.value;
        this.voiceSettings.type = selectedVoice;
        
        if (selectedVoice === 'custom') {
            this.customVoiceUpload.classList.remove('hidden');
        } else {
            this.customVoiceUpload.classList.add('hidden');
            this.voiceSettings.customFile = null;
        }
    }
    
    handleVoiceFileUpload(e) {
        const file = e.target.files[0];
        if (file) {
            this.voiceSettings.customFile = file;
            this.voiceFileName.textContent = file.name;
            this.voiceFileName.classList.remove('hidden');
        } else {
            this.voiceSettings.customFile = null;
            this.voiceFileName.classList.add('hidden');
        }
    }
    
    async handleGenerateStory() {
        const prompt = this.userPrompt.value.trim();
        if (!prompt) {
            this.userPrompt.focus();
            return;
        }
        
        // Validate voice selection
        if (this.voiceSettings.type === 'custom' && !this.voiceSettings.customFile) {
            alert('Please upload a voice sample for custom voice narration.');
            return;
        }
        
        this.showLoading('Generating your story...', 'Creating a unique narrative experience');
        this.setGenerateButtonLoading(true);
        
        try {
            this.currentStory = await this.storyGenerator.generateStory(prompt);
            this.currentPage = 0;
            
            // Set voice settings for narrator
            this.narrator.setVoiceSettings(this.voiceSettings);
            
            this.showStoryScreen();
            await this.displayCurrentPage();
        } catch (error) {
            console.error('Error generating story:', error);
            this.showError('Failed to generate story. Please try again.');
        } finally {
            this.hideLoading();
            this.setGenerateButtonLoading(false);
        }
    }
    
    async displayCurrentPage() {
        const page = this.currentStory.pages[this.currentPage];
        
        // Update UI elements
        this.storyTitle.textContent = this.currentStory.title;
        this.currentPageEl.textContent = this.currentPage + 1;
        this.totalPagesEl.textContent = this.currentStory.pages.length;
        
        // Show loading states
        this.showImageLoading();
        this.showTextLoading();
        
        // Load text
        this.pageText.textContent = page.text;
        this.hideTextLoading();
        
        // Load image
        try {
            if (!page.imageUrl) {
                const imageResult = await websim.imageGen({
                    prompt: page.imagePrompt,
                    aspect_ratio: "16:9"
                });
                page.imageUrl = imageResult.url;
            }
            
            this.pageImage.src = page.imageUrl;
            this.pageImage.onload = () => this.hideImageLoading();
            this.pageImage.onerror = () => {
                this.hideImageLoading();
                console.error('Failed to load image');
            };
        } catch (error) {
            console.error('Error generating image:', error);
            this.hideImageLoading();
        }
        
        // Update navigation buttons
        this.prevBtn.disabled = this.currentPage === 0;
        this.nextBtn.disabled = this.currentPage === this.currentStory.pages.length - 1;
    }
    
    goToPreviousPage() {
        if (this.currentPage > 0) {
            this.currentPage--;
            this.displayCurrentPage();
        }
    }
    
    goToNextPage() {
        if (this.currentPage < this.currentStory.pages.length - 1) {
            this.currentPage++;
            this.displayCurrentPage();
        }
    }
    
    async handleNarration() {
        const page = this.currentStory.pages[this.currentPage];
        
        if (this.narrator.isPlaying) {
            this.narrator.stop();
            this.updateNarrateButton(false);
            return;
        }
        
        this.updateNarrateButton(true);
        
        try {
            await this.narrator.narrate(page.text);
        } catch (error) {
            console.error('Narration error:', error);
        } finally {
            this.updateNarrateButton(false);
        }
    }
    
    updateNarrateButton(isPlaying) {
        const icon = this.narrateBtn.querySelector('.narrate-icon');
        const text = this.narrateBtn.querySelector('.narrate-text');
        
        if (isPlaying) {
            icon.textContent = '⏸️';
            text.textContent = 'Stop';
        } else {
            icon.textContent = '🔊';
            text.textContent = 'Narrate';
        }
    }
    
    showWelcomeScreen() {
        this.welcomeScreen.classList.add('active');
        this.storyScreen.classList.remove('active');
        this.userPrompt.focus();
    }
    
    showStoryScreen() {
        this.welcomeScreen.classList.remove('active');
        this.storyScreen.classList.add('active');
    }
    
    showLoading(text, details) {
        this.loadingText.textContent = text;
        this.loadingDetails.textContent = details;
        this.loadingOverlay.classList.remove('hidden');
    }
    
    hideLoading() {
        this.loadingOverlay.classList.add('hidden');
    }
    
    setGenerateButtonLoading(loading) {
        const btnText = this.generateBtn.querySelector('.btn-text');
        const spinner = this.generateBtn.querySelector('.loading-spinner');
        
        if (loading) {
            btnText.style.opacity = '0';
            spinner.classList.remove('hidden');
            this.generateBtn.disabled = true;
        } else {
            btnText.style.opacity = '1';
            spinner.classList.add('hidden');
            this.generateBtn.disabled = false;
        }
    }
    
    showImageLoading() {
        this.pageImage.style.opacity = '0.3';
        document.querySelector('.image-loading').classList.remove('hidden');
    }
    
    hideImageLoading() {
        this.pageImage.style.opacity = '1';
        document.querySelector('.image-loading').classList.add('hidden');
    }
    
    showTextLoading() {
        this.pageText.style.opacity = '0.3';
        document.querySelector('.text-loading').classList.remove('hidden');
    }
    
    hideTextLoading() {
        this.pageText.style.opacity = '1';
        document.querySelector('.text-loading').classList.add('hidden');
    }
    
    showError(message) {
        alert(message); // Simple error handling - could be enhanced with a nice modal
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new GivingTreeApp();
});