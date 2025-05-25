    async generateAllImages(pages) {
        const imagePromises = pages.map((page, index) => 
            () => this.generateImageWithRetry(page, index)
        );
        
        await this.executeWithRateLimit(imagePromises);
    }

