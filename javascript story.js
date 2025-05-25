export class StoryGenerator {
    constructor() {
        this.conversationHistory = [];
        this.maxConcurrentRequests = 4;
        this.requestDelay = 0;
    }
    
    async generateStory(userPrompt) {
        // Generate the story structure and content
        const storyData = await this.generateStoryStructure(userPrompt);
        const pages = await this.generatePages(storyData, userPrompt);
        
        // Pre-generate all images with rate limiting
        await this.generateAllImages(pages);
        
        return {
            title: storyData.title,
            theme: userPrompt,
            pages: pages
        };
    }

    async generateAllImages(pages) {
        const imagePromises = pages.map((page, index) => 
            this.generateImageWithRetry(page, index)
        );
        
        await this.executeWithRateLimit(imagePromises);
    }

    async generateImageWithRetry(page, index, maxRetries = 3) {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                if (this.requestDelay > 0) {
                    await new Promise(resolve => setTimeout(resolve, this.requestDelay));
                }
                
                const imageResult = await websim.imageGen({
                    prompt: page.imagePrompt,
                    aspect_ratio: "16:9"
                });
                page.imageUrl = imageResult.url;
                return;
            } catch (error) {
                console.warn(`Image generation attempt ${attempt + 1} failed for page ${index + 1}:`, error);
                if (attempt === maxRetries - 1) {
                    throw error;
                }
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
        }
    }

    async executeWithRateLimit(promises) {
        let concurrentRequests = this.maxConcurrentRequests;
        let currentIndex = 0;
        const results = [];
        
        while (currentIndex < promises.length) {
            const batch = promises.slice(currentIndex, currentIndex + concurrentRequests);
            
            try {
                await Promise.all(batch.map(p => p()));
                currentIndex += concurrentRequests;
                
                // Success - try to increase speed slightly
                if (concurrentRequests < this.maxConcurrentRequests && this.requestDelay > 0) {
                    this.requestDelay = Math.max(0, this.requestDelay - 200);
                }
            } catch (error) {
                console.warn(`Batch failed with ${concurrentRequests} concurrent requests, backing off...`);
                
                // Reduce concurrency and add delay
                concurrentRequests = Math.max(1, Math.floor(concurrentRequests / 2));
                this.requestDelay += 500;
                
                // Retry the failed batch with reduced rate
                continue;
            }
        }
    }

    async generateStoryStructure(userPrompt) {
        const systemMessage = {
            role: "system",
            content: `You are a creative storyteller reimagining "The Giving Tree" by Shel Silverstein. 
            Create a story structure that maintains the emotional core of the original but transforms it based on the user's prompt.
            The story should have 6-8 pages and maintain the relationship between a character and a tree, but with the twist the user provides.
            
            Respond with JSON following this schema:
            {
                "title": "string - creative title for the reimagined story",
                "theme": "string - the central theme/emotion of this version",
                "pages": [
                    {
                        "age_stage": "string - life stage (childhood, youth, adulthood, old age, etc.)",
                        "key_moment": "string - what happens in this scene",
                        "emotion": "string - primary emotion"
                    }
                ]
            }`
        };
        
        const userMessage = {
            role: "user",
            content: `Create a reimagined version of "The Giving Tree" where the tree is more ${userPrompt}. Keep the essential relationship but transform the story based on this characteristic.`
        };
        
        const completion = await websim.chat.completions.create({
            messages: [systemMessage, userMessage],
            json: true
        });
        
        return JSON.parse(completion.content);
    }
    
    async generatePages(storyData, userPrompt) {
        const pages = [];
        
        for (let i = 0; i < storyData.pages.length; i++) {
            const pageStructure = storyData.pages[i];
            const page = await this.generatePageContent(pageStructure, userPrompt, i, storyData.pages.length);
            pages.push(page);
        }
        
        return pages;
    }
    
    async generatePageContent(pageStructure, userPrompt, pageIndex, totalPages) {
        const systemMessage = {
            role: "system",
            content: `You are writing a page for a reimagined version of "The Giving Tree" where the tree is more ${userPrompt}.
            Write in the style of Shel Silverstein - simple, poetic, emotionally resonant.
            This is page ${pageIndex + 1} of ${totalPages}.
            Keep the text to 2-4 sentences, suitable for a picture book.
            
            Respond with JSON:
            {
                "text": "string - the story text for this page",
                "imagePrompt": "string - detailed prompt for AI image generation showing this scene"
            }`
        };
        
        const userMessage = {
            role: "user",
            content: `Write page content for: ${JSON.stringify(pageStructure)}`
        };
        
        const completion = await websim.chat.completions.create({
            messages: [systemMessage, userMessage],
            json: true
        });
        
        const pageData = JSON.parse(completion.content);
        
        return {
            text: pageData.text,
            imagePrompt: `Children's book illustration: ${pageData.imagePrompt}. Soft, warm, hand-drawn style reminiscent of Shel Silverstein. Simple lines, expressive characters, natural colors.`,
            imageUrl: null, // Will be generated when needed
            audioUrl: null // Will be generated during story creation
        };
    }

    async generateNarrationForPages(pages, voiceSettings) {
        for (let i = 0; i < pages.length; i++) {
            try {
                let result;
                
                if (voiceSettings.type === 'custom' && voiceSettings.customFile) {
                    const fileDataUrl = await this.fileToDataUrl(voiceSettings.customFile);
                    result = await websim.textToSpeech({
                        text: pages[i].text,
                        voice_sample: fileDataUrl
                    });
                } else {
                    result = await websim.textToSpeech({
                        text: pages[i].text,
                        voice: voiceSettings.type
                    });
                }
                
                pages[i].audioUrl = result.url;
            } catch (error) {
                console.error(`Error generating narration for page ${i + 1}:`, error);
            }
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
}