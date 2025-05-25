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
        this.room = new WebsimSocket();
        
        this.initializeElements();
        this.bindEvents();
    }
    
    initializeElements() {
        // Screens
        this.welcomeScreen = document.getElementById('welcome-screen');
        this.storyScreen = document.getElementById('story-screen');
        this.galleryScreen = document.getElementById('gallery-screen');
        this.loadingOverlay = document.getElementById('loading-overlay');
        
        // Welcome screen elements
        this.userPrompt = document.getElementById('user-prompt');
        this.generateBtn = document.getElementById('generate-btn');
        this.saveToGalleryCheckbox = document.getElementById('save-to-gallery');
        
        // Voice selection elements
        this.voiceOptions = document.querySelectorAll('input[name="voice"]');
        this.customVoiceUpload = document.getElementById('custom-voice-upload');
        this.voiceFileInput = document.getElementById('voice-file');
        this.voiceFileName = document.getElementById('voice-file-name');
        
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
        
        // Loading elements
        this.loadingText = document.getElementById('loading-text');
        this.loadingDetails = document.getElementById('loading-details');
        
        // Gallery elements
        this.galleryBtn = document.getElementById('gallery-btn');
        this.galleryBackBtn = document.getElementById('gallery-back-btn');
        this.galleryGrid = document.getElementById('gallery-grid');
        this.galleryLoading = document.querySelector('.gallery-loading');
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
        
        this.galleryBtn.addEventListener('click', () => this.showGalleryScreen());
        this.galleryBackBtn.addEventListener('click', () => this.showStoryScreen());
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
            
            this.showLoading('Finalizing...', 'Preparing your story experience');
            
            // Save to gallery if opted in
            if (this.saveToGalleryCheckbox.checked) {
                await this.saveStoryToGallery();
            }
            
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
    
    async saveStoryToGallery() {
        try {
            const storyData = {
                title: this.currentStory.title,
                theme: this.currentStory.theme,
                pages: this.currentStory.pages.map(page => ({
                    text: page.text,
                    imagePrompt: page.imagePrompt,
                    imageUrl: page.imageUrl
                    // Don't save audioUrl for privacy/storage reasons
                })),
                pageCount: this.currentStory.pages.length
            };
            
            await this.room.collection('giving_tree_story').create(storyData);
        } catch (error) {
            console.error('Error saving story to gallery:', error);
            // Don't show error to user as this is optional
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
        this.storyScreen.classList.remove('active');
        this.galleryScreen.classList.remove('active');
        this.userPrompt.focus();
    }
    
    showStoryScreen() {
        this.welcomeScreen.classList.remove('active');
        this.galleryScreen.classList.remove('active');
        this.storyScreen.classList.add('active');
    }
    
    showGalleryScreen() {
        this.storyScreen.classList.remove('active');
        this.welcomeScreen.classList.remove('active');
        this.galleryScreen.classList.add('active');
        
        this.galleryLoading.classList.remove('hidden');
        this.galleryGrid.innerHTML = '';
        
        try {
            await this.loadGalleryStories();
        } catch (error) {
            console.error('Error loading gallery:', error);
            this.galleryGrid.innerHTML = '<p style="text-align: center; color: var(--text-light);">Failed to load stories</p>';
        } finally {
            this.galleryLoading.classList.add('hidden');
        }
    }
    
    async loadGalleryStories() {
        const stories = this.room.collection('giving_tree_story').getList();
        
        // Subscribe to changes
        this.room.collection('giving_tree_story').subscribe((updatedStories) => {
            this.renderGalleryStories(updatedStories);
        });
        
        this.renderGalleryStories(stories);
    }
    
    renderGalleryStories(stories) {
        if (stories.length === 0) {
            this.galleryGrid.innerHTML = '<p style="text-align: center; color: var(--text-light); grid-column: 1 / -1;">No stories yet. Be the first to create one!</p>';
            return;
        }
        
        // Sort newest first (reverse since getList returns oldest first)
        const sortedStories = [...stories].reverse();
        
        this.galleryGrid.innerHTML = sortedStories.map(story => `
            <div class="story-card" onclick="app.viewGalleryStory('${story.id}')">
                <img class="story-card-image" src="${story.pages[0]?.imageUrl || ''}" alt="${story.title}" />
                <div class="story-card-content">
                    <h3 class="story-card-title">${story.title}</h3>
                    <p class="story-card-theme">"${story.theme}" tree • ${story.pageCount} pages</p>
                    <div class="story-card-author">
                        <img class="author-avatar" src="https://images.websim.com/avatar/${story.username}" alt="${story.username}" />
                        <span>by ${story.username}</span>
                        <span style="margin-left: auto; font-size: 0.7rem;">${new Date(story.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    async viewGalleryStory(storyId) {
        try {
            const stories = this.room.collection('giving_tree_story').getList();
            const story = stories.find(s => s.id === storyId);
            
            if (story) {
                // Load the gallery story for viewing
                this.currentStory = {
                    title: story.title,
                    theme: story.theme,
                    pages: story.pages
                };
                this.currentPage = 0;
                
                this.showStoryScreen();
                await this.displayCurrentPage();
            }
        } catch (error) {
            console.error('Error viewing gallery story:', error);
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

// Make app globally accessible for gallery card clicks
let app;

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    app = new GivingTreeApp();
});