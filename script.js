import { StoryGenerator } from './story.js';
import { Narrator } from './narrator.js';

// Initialize WebsimSocket for public stories
const room = new WebsimSocket();

class GivingTreeApp {
    constructor() {
        this.storyGenerator = new StoryGenerator();
        this.narrator = new Narrator();
        this.currentStory = null;
        this.currentPage = 0;
        this.autoNarrate = false;
        this.voiceSettings = {
            type: 'en-female',
            customFile: null
        };
        this.privacySetting = 'public';
        
        this.initializeElements();
        this.bindEvents();
        this.loadGalleryIfNeeded();
    }
    
    initializeElements() {
        // Screens
        this.welcomeScreen = document.getElementById('welcome-screen');
        this.createScreen = document.getElementById('create-screen');
        this.galleryScreen = document.getElementById('gallery-screen');
        this.storyScreen = document.getElementById('story-screen');
        this.loadingOverlay = document.getElementById('loading-overlay');
        
        // Welcome screen elements
        this.createStoryBtn = document.getElementById('create-story-btn');
        this.viewGalleryBtn = document.getElementById('view-gallery-btn');
        
        // Create screen elements
        this.backToWelcomeBtn = document.getElementById('back-to-welcome-btn');
        this.userPrompt = document.getElementById('user-prompt');
        this.generateBtn = document.getElementById('generate-btn');
        this.privacyOptions = document.querySelectorAll('input[name="privacy"]');
        
        // Gallery screen elements
        this.backToWelcomeFromGalleryBtn = document.getElementById('back-to-welcome-from-gallery-btn');
        this.galleryGrid = document.getElementById('gallery-grid');
        this.storyCount = document.getElementById('story-count');
        
        // Story screen elements
        this.backBtn = document.getElementById('back-btn');
        this.storyTitle = document.getElementById('story-title');
        this.narrateBtn = document.getElementById('narrate-btn');
        this.autoNarrateBtn = document.getElementById('auto-narrate-btn');
        this.currentPageEl = document.getElementById('current-page');
        this.totalPagesEl = document.getElementById('total-pages');
        this.pageImage = document.getElementById('page-image');
        this.pageText = document.getElementById('page-text');
        this.prevBtn = document.getElementById('prev-btn');
        this.nextBtn = document.getElementById('next-btn');
        
        // Voice selection elements
        this.voiceOptions = document.querySelectorAll('input[name="voice"]');
        this.customVoiceUpload = document.getElementById('custom-voice-upload');
        this.voiceFileInput = document.getElementById('voice-file');
        this.voiceFileName = document.getElementById('voice-file-name');
        
        // Loading elements
        this.loadingText = document.getElementById('loading-text');
        this.loadingDetails = document.getElementById('loading-details');
    }
    
    bindEvents() {
        // Welcome screen events
        this.createStoryBtn.addEventListener('click', () => this.showCreateScreen());
        this.viewGalleryBtn.addEventListener('click', () => this.showGalleryScreen());
        
        // Create screen events
        this.backToWelcomeBtn.addEventListener('click', () => this.showWelcomeScreen());
        this.generateBtn.addEventListener('click', () => this.handleGenerateStory());
        this.userPrompt.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleGenerateStory();
        });
        
        // Gallery screen events
        this.backToWelcomeFromGalleryBtn.addEventListener('click', () => this.showWelcomeScreen());
        
        // Privacy selection events
        this.privacyOptions.forEach(option => {
            option.addEventListener('change', (e) => {
                this.privacySetting = e.target.value;
            });
        });
        
        // Voice selection events
        this.voiceOptions.forEach(option => {
            option.addEventListener('change', (e) => this.handleVoiceSelection(e));
        });
        
        this.voiceFileInput.addEventListener('change', (e) => this.handleVoiceFileUpload(e));
        
        // Story screen events
        this.backBtn.addEventListener('click', () => this.showWelcomeScreen());
        this.narrateBtn.addEventListener('click', () => this.handleNarration());
        this.autoNarrateBtn.addEventListener('click', () => this.toggleAutoNarrate());
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

    loadGalleryIfNeeded() {
        // Subscribe to public stories for gallery updates
        room.collection('story').subscribe((stories) => {
            this.updateGallery(stories);
        });
    }

    showWelcomeScreen() {
        this.hideAllScreens();
        this.welcomeScreen.classList.add('active');
    }

    showCreateScreen() {
        this.hideAllScreens();
        this.createScreen.classList.add('active');
        this.userPrompt.focus();
    }

    showGalleryScreen() {
        this.hideAllScreens();
        this.galleryScreen.classList.add('active');
        this.loadGallery();
    }

    showStoryScreen() {
        this.hideAllScreens();
        this.storyScreen.classList.add('active');
    }

    hideAllScreens() {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
    }

    async loadGallery() {
        const stories = room.collection('story').getList();
        this.updateGallery(stories);
    }

    updateGallery(stories) {
        // Sort stories by creation date (newest first)
        const sortedStories = [...stories].reverse();
        
        this.storyCount.textContent = `${sortedStories.length} ${sortedStories.length === 1 ? 'story' : 'stories'}`;
        
        if (sortedStories.length === 0) {
            this.galleryGrid.innerHTML = `
                <div class="gallery-empty">
                    <p>No public stories yet. Be the first to create one!</p>
                </div>
            `;
            return;
        }
        
        this.galleryGrid.innerHTML = sortedStories.map(story => this.createStoryCard(story)).join('');
        
        // Add click listeners to story cards
        this.galleryGrid.querySelectorAll('.story-card').forEach((card, index) => {
            card.addEventListener('click', () => this.loadStoryFromGallery(sortedStories[index]));
        });
    }

    createStoryCard(story) {
        const firstImage = story.pages && story.pages[0] && story.pages[0].imageUrl 
            ? story.pages[0].imageUrl 
            : '';
        
        const date = new Date(story.created_at).toLocaleDateString();
        
        return `
            <div class="story-card" data-story-id="${story.id}">
                ${firstImage ? `<img src="${firstImage}" alt="${story.title}" class="story-card-image">` : '<div class="story-card-image"></div>'}
                <div class="story-card-content">
                    <h3 class="story-card-title">${story.title}</h3>
                    <p class="story-card-theme">The tree was more ${story.theme}...</p>
                    <div class="story-card-meta">
                        <span class="story-card-author">by ${story.username}</span>
                        <span class="story-card-date">${date}</span>
                    </div>
                </div>
            </div>
        `;
    }

    async loadStoryFromGallery(storyData) {
        this.currentStory = {
            title: storyData.title,
            theme: storyData.theme,
            pages: storyData.pages
        };
        this.currentPage = 0;
        
        this.showStoryScreen();
        await this.displayCurrentPage();
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
        
        this.showLoading('Generating your story...', 'Creating narrative structure');
        this.setGenerateButtonLoading(true);
        
        try {
            // Generate story content
            this.showLoading('Generating story content...', 'Creating pages and illustrations');
            this.currentStory = await this.storyGenerator.generateStory(prompt);
            this.currentPage = 0;
            
            // Set voice settings for narrator
            this.narrator.setVoiceSettings(this.voiceSettings);
            
            // Generate all narration
            this.showLoading('Generating narration...', 'Creating audio for all pages');
            await this.storyGenerator.generateNarrationForPages(this.currentStory.pages, this.voiceSettings);
            
            // Save story based on privacy setting
            this.showLoading('Saving story...', 'Preparing your story experience');
            await this.saveStory();
            
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

    async saveStory() {
        const storyData = {
            title: this.currentStory.title,
            theme: this.currentStory.theme,
            pages: this.currentStory.pages,
            prompt: this.userPrompt.value.trim(),
            voiceSettings: this.voiceSettings
        };

        if (this.privacySetting === 'public') {
            // Save to database
            await room.collection('story').create(storyData);
        } else {
            // Save to localStorage
            const privateStories = JSON.parse(localStorage.getItem('privateStories') || '[]');
            const storyWithId = {
                ...storyData,
                id: Date.now().toString(),
                created_at: new Date().toISOString(),
                username: 'You'
            };
            privateStories.push(storyWithId);
            localStorage.setItem('privateStories', JSON.stringify(privateStories));
        }
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
    
    async displayCurrentPage() {
        const page = this.currentStory.pages[this.currentPage];
        
        // Update UI elements
        this.storyTitle.textContent = this.currentStory.title;
        this.currentPageEl.textContent = this.currentPage + 1;
        this.totalPagesEl.textContent = this.currentStory.pages.length;
        
        // Load text (already generated)
        this.pageText.textContent = page.text;
        this.hideTextLoading();
        
        // Load image (already generated)
        if (page.imageUrl) {
            this.pageImage.src = page.imageUrl;
            this.pageImage.onload = () => this.hideImageLoading();
            this.pageImage.onerror = () => {
                this.hideImageLoading();
                console.error('Failed to load pre-generated image');
            };
        } else {
            this.hideImageLoading();
        }
        
        // Update navigation buttons
        this.prevBtn.disabled = this.currentPage === 0;
        this.nextBtn.disabled = this.currentPage === this.currentStory.pages.length - 1;
        
        // Auto-narrate if enabled
        if (this.autoNarrate && page.audioUrl) {
            await this.playPreGeneratedNarration();
        }
    }
    
    goToPreviousPage() {
        if (this.currentPage > 0) {
            this.narrator.stop(); // Stop current narration
            this.currentPage--;
            this.displayCurrentPage();
        }
    }
    
    goToNextPage() {
        if (this.currentPage < this.currentStory.pages.length - 1) {
            this.narrator.stop(); // Stop current narration
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
            if (page.audioUrl) {
                await this.playPreGeneratedNarration();
            } else {
                await this.narrator.narrate(page.text);
            }
        } catch (error) {
            console.error('Narration error:', error);
        } finally {
            this.updateNarrateButton(false);
        }
    }
    
    async playPreGeneratedNarration() {
        const page = this.currentStory.pages[this.currentPage];
        if (!page.audioUrl) return;
        
        await this.narrator.playPreGeneratedAudio(page.audioUrl);
    }
    
    toggleAutoNarrate() {
        this.autoNarrate = !this.autoNarrate;
        this.updateAutoNarrateButton();
    }
    
    updateAutoNarrateButton() {
        if (this.autoNarrate) {
            this.autoNarrateBtn.classList.remove('auto-narrate-off');
            this.autoNarrateBtn.classList.add('auto-narrate-on');
            this.autoNarrateBtn.querySelector('.auto-narrate-text').textContent = 'Auto ON';
        } else {
            this.autoNarrateBtn.classList.remove('auto-narrate-on');
            this.autoNarrateBtn.classList.add('auto-narrate-off');
            this.autoNarrateBtn.querySelector('.auto-narrate-text').textContent = 'Auto';
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