/**
 * image-optimizer.js
 * Gère le chargement intelligent des images (WebP avec fallback JPEG)
 * À ajouter dans index.html : <script src="image-optimizer.js"></script>
 */

class ImageOptimizer {
    constructor() {
        this.webpSupported = this.detectWebPSupport();
        console.log(`[ImageOptimizer] WebP supporté: ${this.webpSupported}`);
    }

    /**
     * Détecter si le navigateur supporte WebP
     */
    detectWebPSupport() {
        try {
            // iOS 14+ et Android Chrome 32+ supportent WebP nativement
            // → raccourci fiable même en navigation privée (évite le bug canvas iOS)
            const ua = navigator.userAgent;
            const iosMatch = ua.match(/OS (\d+)_/);
            if (iosMatch && parseInt(iosMatch[1]) >= 14) return true;

            // Fallback : test canvas pour les autres navigateurs
            const elem = document.createElement('canvas');
            if (!!(elem.getContext && elem.getContext('2d'))) {
                return elem.toDataURL('image/webp').indexOf('image/webp') === 5;
            }
            return false;
        } catch (err) {
            return false;
        }
    }

    /**
     * Retourner l'URL optimisée (WebP ou JPG original)
     */
    getOptimizedUrl(originalUrl) {
        if (!originalUrl) return '';
        
        // Si l'URL est déjà un WebP, la retourner telle quelle
        if (originalUrl.endsWith('.webp')) {
            return originalUrl;
        }

        // Si le navigateur supporte WebP
        if (this.webpSupported) {
            const webpUrl = originalUrl.replace(/\.(jpg|jpeg)$/, '.webp');
            return webpUrl;
        }

        // Sinon, retourner le JPG original
        return originalUrl;
    }

    /**
     * Créer une balise img avec srcset optimal
     */
    createOptimizedImg(originalUrl, alt = '', className = '', loading = 'lazy') {
        const img = document.createElement('img');
        
        if (this.webpSupported) {
            const webpUrl = originalUrl.replace(/\.(jpg|jpeg)$/, '.webp');
            img.srcset = `${webpUrl} 1x`;
        }
        
        img.src = originalUrl; // Fallback
        img.alt = alt;
        img.className = className;
        img.loading = loading;
        
        return img;
    }

    /**
     * Optimiser une balise img existante
     */
    optimizeExistingImg(img) {
        const originalSrc = img.src;
        img.src = this.getOptimizedUrl(originalSrc);
        
        if (this.webpSupported && !originalSrc.endsWith('.webp')) {
            const webpUrl = originalSrc.replace(/\.(jpg|jpeg)$/, '.webp');
            img.srcset = `${webpUrl} 1x`;
        }
    }

    /**
     * Optimiser tous les img du DOM
     */
    optimizeAllImages(selector = 'img') {
        document.querySelectorAll(selector).forEach(img => {
            this.optimizeExistingImg(img);
        });
    }
}

// Instance globale
const imageOptimizer = new ImageOptimizer();

// Au chargement du DOM, optimiser les images
document.addEventListener('DOMContentLoaded', () => {
    imageOptimizer.optimizeAllImages('img');
});

// Exporter pour les tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageOptimizer;
}
