(() => {
    'use strict';

    const getRuntimeURL = (path) => {
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
                return chrome.runtime.getURL(path);
            if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.getURL)
                return browser.runtime.getURL(path);
        } catch (e) {}
        return path;
    };

    const getStorageArea = () => {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local)
                return chrome.storage.local;
            if (typeof browser !== 'undefined' && browser.storage && browser.storage.local)
                return browser.storage.local;
        } catch (e) {}
        return null;
    };

    const storageGet = (defaults) => {
        const area = getStorageArea();
        if (!area) return Promise.resolve(defaults);

        try {
            const result = area.get(defaults);
            if (result && typeof result.then === 'function') return result;
        } catch (e) {}

        return new Promise((resolve) => {
            area.get(defaults, (items) => resolve(items || defaults));
        });
    };

    const storageSet = (items) => {
        const area = getStorageArea();
        if (!area) return Promise.resolve();

        try {
            const result = area.set(items);
            if (result && typeof result.then === 'function') return result;
        } catch (e) {}

        return new Promise((resolve) => {
            area.set(items, () => resolve());
        });
    };

    window.CFDarkThemeUtils = {
        getRuntimeURL,
        getStorageArea,
        storageGet,
        storageSet,
    };
})();
