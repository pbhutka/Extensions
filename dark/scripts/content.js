(() => {
    'use strict';

    const STORAGE_KEY_ENABLED = 'enabled';
    const { getRuntimeURL, storageGet } = window.CFDarkThemeUtils;

    let themeEnabled = true;
    let themeInitialized = false;
    const cleanupCallbacks = [];
    const resourceNodes = [];
    const originalStyleAttributes = new WeakMap();

    const colors = {
        whiteTextColor: 'rgb(220, 220, 220)',
        redColorJustPassesA11Y: '#ff3333',
    };

    const addCleanup = (fn) => cleanupCallbacks.push(fn);

    const clearCleanupCallbacks = () => {
        while (cleanupCallbacks.length > 0) {
            const fn = cleanupCallbacks.pop();
            try { fn(); } catch (e) {}
        }
    };

    const removeInjectedResources = () => {
        while (resourceNodes.length > 0) {
            const node = resourceNodes.pop();
            try {
                if (node && node.parentNode) node.parentNode.removeChild(node);
            } catch (e) {}
        }
    };

    const injectResource = (tagName, attrs) => {
        const parent = document.head || document.documentElement;
        if (!parent) return null;

        const node = document.createElement(tagName);
        for (const key in attrs) {
            if (Object.prototype.hasOwnProperty.call(attrs, key)) {
                node.setAttribute(key, attrs[key]);
            }
        }
        parent.appendChild(node);
        resourceNodes.push(node);
        return node;
    };

    const loadLocalStyles = () => {
        const styles = ['/css/style.css', 'desert.css', 'monokai.css'];
        styles.forEach(style => {
            injectResource('link', {
                rel: 'stylesheet',
                href: getRuntimeURL(style),
                'data-codeforces-darktheme': 'true',
            });
        });
    };

    const overrideStyleAttribute = (elm, prop, value) => {
        try {
            if (!originalStyleAttributes.has(elm)) {
                originalStyleAttributes.set(elm, elm.getAttribute('style'));
                addCleanup(() => {
                    try {
                        const originalStyle = originalStyleAttributes.get(elm);
                        if (originalStyle === null) {
                            elm.removeAttribute('style');
                        } else if (typeof originalStyle !== 'undefined') {
                            elm.setAttribute('style', originalStyle);
                        }
                        originalStyleAttributes.delete(elm);
                    } catch (e) {}
                });
            }
            elm.style.setProperty(prop, value, 'important');
        } catch (e) {}
    };

    const addClassWithCleanup = (elm, className) => {
        const hadClass = elm.classList.contains(className);
        elm.classList.add(className);
        if (!hadClass) {
            addCleanup(() => {
                try { elm.classList.remove(className); } catch (e) {}
            });
        }
    };

    const setStylePropertyWithCleanup = (elm, prop, value, priority) => {
        const previousValue = elm.style.getPropertyValue(prop);
        const previousPriority = elm.style.getPropertyPriority(prop);
        elm.style.setProperty(prop, value, priority || '');
        addCleanup(() => {
            try {
                if (previousValue) {
                    elm.style.setProperty(prop, previousValue, previousPriority);
                } else {
                    elm.style.removeProperty(prop);
                }
            } catch (e) {}
        });
    };

    const setAttributeWithCleanup = (elm, name, value) => {
        const hadAttribute = elm.hasAttribute(name);
        const previousValue = elm.getAttribute(name);
        elm.setAttribute(name, value);
        addCleanup(() => {
            try {
                if (hadAttribute) {
                    elm.setAttribute(name, previousValue);
                } else {
                    elm.removeAttribute(name);
                }
            } catch (e) {}
        });
    };

    /**
     * Optimal DOM Monitoring
     * Uses a single observer for all selectors and throtlles updates.
     */
    const createGlobalObserver = (tasks) => {
        const applyAll = (root) => {
            if (!themeEnabled) return;
            tasks.forEach(({ selector, callback }) => {
                if (root.nodeType === 1 && root.matches(selector)) callback(root);
                root.querySelectorAll(selector).forEach(callback);
            });
        };

        const observer = new MutationObserver((mutations) => {
            if (!themeEnabled) return;

            // Use a Set to avoid redundant processing of the same node
            const nodesToProcess = new Set();
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) nodesToProcess.add(node);
                }
            }

            nodesToProcess.forEach(applyAll);
        });

        observer.observe(document.documentElement, { childList: true, subtree: true });

        // Initial apply
        applyAll(document.documentElement);

        addCleanup(() => observer.disconnect());
    };

    const enableTheme = () => {
        if (themeInitialized) return;
        themeInitialized = true;
        loadLocalStyles();

        const themeTasks = [
            {
                selector: '#pageContent div div h3 a, .comment-table.highlight-blue .right .ttypography p, .comment-table.highlight-blue .right .info',
                callback: (elm) => {
                    const obs = new MutationObserver((mutationList) => {
                        if (!themeEnabled) {
                            obs.disconnect();
                            return;
                        }
                        for (const mutation of mutationList) {
                            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                                if (elm.style.getPropertyValue('color') !== 'white' ||
                                    elm.style.getPropertyPriority('color') !== 'important') {
                                    elm.style.setProperty('color', 'white', 'important');
                                }
                            }
                        }
                    });
                    overrideStyleAttribute(elm, 'color', 'white');
                    obs.observe(elm, { attributes: true, attributeFilter: ['style'] });
                    addCleanup(() => obs.disconnect());
                }
            },
            {
                selector: '.datatable div:nth-child(5)',
                callback: (elm) => addClassWithCleanup(elm, 'dark')
            },
            {
                selector: '.unread td',
                callback: (elm) => setStylePropertyWithCleanup(elm, 'background-color', '#13203a', 'important')
            },
            {
                selector: 'body > h3',
                callback: (elm) => {
                    if (elm.innerText && elm.innerText.startsWith('The requested URL was not found on this server.')) {
                        addClassWithCleanup(document.body, 'notfoundpage');
                    }
                }
            },
            {
                selector: '.second-level-menu-list li.backLava',
                callback: (elm) => {
                    try {
                        setStylePropertyWithCleanup(elm, 'background-image', `url(${getRuntimeURL('/images/lava-right2.png')})`);
                        if (elm.firstElementChild) {
                            setStylePropertyWithCleanup(elm.firstElementChild, 'background-image', `url(${getRuntimeURL('images/lava-left2.png')})`);
                        }
                    } catch (e) {}
                }
            },
            {
                selector: '#editor',
                callback: (elm) => {
                    const aceChromeClass = 'ace-chrome';
                    const aceMonokaiClass = 'ace-monokai';
                    const hadChromeClass = elm.classList.contains(aceChromeClass);
                    const hadMonokaiClass = elm.classList.contains(aceMonokaiClass);

                    const applyAceTheme = () => {
                        if (!themeEnabled) return;
                        if (elm.classList.contains(aceChromeClass)) {
                            elm.classList.remove(aceChromeClass);
                        }
                        if (!elm.classList.contains(aceMonokaiClass)) {
                            elm.classList.add(aceMonokaiClass);
                        }
                    };

                    applyAceTheme();
                    const observer = new MutationObserver(applyAceTheme);
                    observer.observe(elm, { attributes: true, attributeFilter: ['class'] });
                    addCleanup(() => {
                        try {
                            observer.disconnect();
                            if (hadChromeClass) elm.classList.add(aceChromeClass);
                            else elm.classList.remove(aceChromeClass);
                            if (!hadMonokaiClass) elm.classList.remove(aceMonokaiClass);
                        } catch (e) {}
                    });
                }
            }
        ];

        createGlobalObserver(themeTasks);
    };

    const disableTheme = () => {
        if (!themeInitialized) {
            removeInjectedResources();
            return;
        }
        themeInitialized = false;
        clearCleanupCallbacks();
        removeInjectedResources();
    };

    const setThemeEnabled = (enabled) => {
        themeEnabled = enabled !== false;
        if (themeEnabled) {
            enableTheme();
        } else {
            disableTheme();
        }
    };

    storageGet({ [STORAGE_KEY_ENABLED]: true })
        .then((items) => {
            setThemeEnabled(items[STORAGE_KEY_ENABLED] !== false);
        })
        .catch(() => {
            setThemeEnabled(true);
        });

    const storageArea = window.CFDarkThemeUtils.getStorageArea();
    if (storageArea && storageArea.onChanged && storageArea.onChanged.addListener) {
        storageArea.onChanged.addListener((changes) => {
            if (changes && Object.prototype.hasOwnProperty.call(changes, STORAGE_KEY_ENABLED)) {
                const nextEnabled = changes[STORAGE_KEY_ENABLED].newValue !== false;
                setThemeEnabled(nextEnabled);
            }
        });
    }
})();
