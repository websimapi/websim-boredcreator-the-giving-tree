import { StoryGenerator } from './story.js';
import { Narrator } from './narrator.js';

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
        this.currentTab = 'public';
        
        // Initialize database
        this.room = new WebsimSocket();
        
        this.initializeElements();
        this.bindEvents();
        this.loadGallery();
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
        this.browseGalleryBtn = document.getElementById('browse-gallery-btn');
        
        // Create screen elements
        this.backToWelcomeBtn = document.getElementById('back-to-welcome-btn');
        this.userPrompt = document.getElementById('user-prompt');
        this.generateBtn = document.getElementById('generate-btn');
        this.privacyOptions = document.querySelectorAll('input[name="privacy"]');
        
        // Gallery elements
        this.backToWelcomeGalleryBtn = document.getElementById('back-to-welcome-gallery-btn');
        this.publicTab = document.getElementById('public-tab');
        this.privateTab = document.getElementById('private-tab');
        this.galleryGrid = document.getElementById('gallery-grid');
        this.galleryEmpty = document.getElementById('gallery-empty');
        
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
        this.browseGalleryBtn.addEventListener('click', () => this.showGalleryScreen());
        
        // Create screen events
        this.backToWelcomeBtn.addEventListener('click', () => this.showWelcomeScreen());
        this.generateBtn.addEventListener('click', () => this.handleGenerateStory());
        this.userPrompt.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleGenerateStory();
        });
        
        // Privacy selection events
        this.privacyOptions.forEach(option => {
            option.addEventListener('change', (e) => {
                this.privacySetting = e.target.value;
            });
        });
        
        // Gallery events
        this.backToWelcomeGalleryBtn.addEventListener('click', () => this.showWelcomeScreen());
        this.publicTab.addEventListener('click', () => this.switchTab('public'));
        this.privateTab.addEventListener('click', () => this.switchTab('private'));
        
        // Voice selection events
        this.voiceOptions.forEach(option => {
            option.addEventListener('change', (e) => this.handleVoiceSelection(e));
        });
        
        this.voiceFileInput.addEventListener('change', (e) => this.handleVoiceFileUpload(e));
        
        this.backBtn.addEventListener('click', () => this.showGalleryScreen());
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
    
    async loadGallery() {
        try {
            // Subscribe to public stories
            this.room.collection('story').subscribe((stories) => {
                this.renderGallery(stories, 'public');
            });
        } catch (error) {
            console.error('Error loading gallery:', error);
        }
    }
    
    switchTab(tab) {
        this.currentTab = tab;
        
        // Update tab buttons
        this.publicTab.classList.toggle('active', tab === 'public');
        this.privateTab.classList.toggle('active', tab === 'private');
        
        if (tab === 'public') {
            const publicStories = this.room.collection('story').getList();
            this.renderGallery(publicStories, 'public');
        } else {
            const privateStories = this.getPrivateStories();
            this.renderGallery(privateStories, 'private');
        }
    }
    
    getPrivateStories() {
        try {
            const stored = localStorage.getItem('private-stories');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error loading private stories:', error);
            return [];
        }
    }
    
    savePrivateStory(story) {
        try {
            const stories = this.getPrivateStories();
            stories.unshift({
                ...story,
                id: Date.now().toString(),
                created_at: new Date().toISOString()
            });
            localStorage.setItem('private-stories', JSON.stringify(stories));
        } catch (error) {
            console.error('Error saving private story:', error);
        }
    }
    
    renderGallery(stories, type) {
        if (!stories || stories.length === 0) {
            this.galleryGrid.classList.add('hidden');
            this.galleryEmpty.classList.remove('hidden');
            return;
        }
        
        this.galleryGrid.classList.remove('hidden');
        this.galleryEmpty.classList.add('hidden');
        
        this.galleryGrid.innerHTML = stories.map(story => {
            const firstImage = story.pages && story.pages[0] ? story.pages[0].imageUrl : '';
            const date = new Date(story.created_at).toLocaleDateString();
            const author = type === 'public' ? story.username : 'You';
            
            return `
                <div class="story-card" data-story-id="${story.id}" data-story-type="${type}">
                    <img src="${firstImage}" alt="${story.title}" class="story-card-image" 
                         onerror="this.style.display='none'">
                    <div class="story-card-content">
                        <h3 class="story-card-title">${story.title}</h3>
                        <p class="story-card-theme">Theme: ${story.theme}</p>
                        <div class="story-card-meta">
                            <span class="story-card-author">By ${author}</span>
                            <span class="story-card-date">${date}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Add click handlers to story cards
        this.galleryGrid.querySelectorAll('.story-card').forEach(card => {
            card.addEventListener('click', () => {
                const storyId = card.dataset.storyId;
                const storyType = card.dataset.storyType;
                this.loadStoryFromGallery(storyId, storyType);
            });
        });
    }
    
    loadStoryFromGallery(storyId, storyType) {
        let story;
        
        if (storyType === 'public') {
            const publicStories = this.room.collection('story').getList();
            story = publicStories.find(s => s.id === storyId);
        } else {
            const privateStories = this.getPrivateStories();
            story = privateStories.find(s => s.id === storyId);
        }
        
        if (story) {
            this.currentStory = story;
            this.currentPage = 0;
            this.narrator.setVoiceSettings(this.voiceSettings);
            this.showStoryScreen();
            this.displayCurrentPage();
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
            
            this.showLoading('Saving story...', 'Finalizing your story experience');
            
            // Save story based on privacy setting
            await this.saveStory(this.currentStory);
            
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
    
    async saveStory(story) {
        try {
            if (this.privacySetting === 'public') {
                await this.room.collection('story').create({
                    title: story.title,
                    theme: story.theme,
                    pages: story.pages
                });
            } else {
                this.savePrivateStory(story);
            }
        } catch (error) {
            console.error('Error saving story:', error);
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
    
    showWelcomeScreen() {
        this.welcomeScreen.classList.add('active');
        this.createScreen.classList.remove('active');
        this.galleryScreen.classList.remove('active');
        this.storyScreen.classList.remove('active');
    }
    
    showCreateScreen() {
        this.welcomeScreen.classList.remove('active');
        this.createScreen.classList.add('active');
        this.galleryScreen.classList.remove('active');
        this.storyScreen.classList.remove('active');
        this.userPrompt.focus();
    }
    
    showGalleryScreen() {
        this.welcomeScreen.classList.remove('active');
        this.createScreen.classList.remove('active');
        this.galleryScreen.classList.add('active');
        this.storyScreen.classList.remove('active');
        this.switchTab(this.currentTab);
    }
    
    showStoryScreen() {
        this.welcomeScreen.classList.remove('active');
        this.createScreen.classList.remove('active');
        this.galleryScreen.classList.remove('active');
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