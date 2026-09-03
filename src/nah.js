(function () {
    // Only run on main YouTube pages, not in iframes or sandboxed contexts
    if (
        window !== window.top ||
        window.location.href === "about:blank" ||
        !window.location.hostname.includes("youtube.com") ||
        document.documentElement.hasAttribute("sandbox")
    ) {
        return;
    }

    async function clickButton(button) {
        if (!button || !button.isConnected) {
            logger("no target");
            return;
        }

        const isTouchscreenEnabled = await getFromStorage(
            "isTouchscreenEnabled",
        );

        if (!isTouchscreenEnabled) {
            button.click();
            return;
        }

        await ensureBridge();

        const token = Math.random().toString(36).slice(2);
        button.setAttribute("data-ext-target", token);

        // Post to the same frame the element is in
        const frameWin = button.ownerDocument.defaultView || window;
        // use '*' to handle about:blank/srcdoc
        frameWin.postMessage({ __ext__: "activate", token }, "*");
    }

    const pageLang = document.documentElement.lang;

    logger({ pageLang });

    function isChannelPage() {
        const p = window.location.pathname;
        return (
            p.startsWith("/@") ||
            p.startsWith("/channel/") ||
            p.startsWith("/c/")
        );
    }

    function getActiveLabels() {
        if (window.location.pathname === "/feed/subscriptions")
            return SUBSCRIPTION_LABELS;
        return LABELS;
    }

    // keep running so when new videos appear, ie. on page scroll, we add button to them as well
    setInterval(() => {
        if (isChannelPage()) return;

        // subscriptions
        addNahBtns("ytd-rich-grid-media #details");

        // homepage, recommended videos
        addNahBtns("yt-lockup-metadata-view-model");

        // not sure if this is needed anymore
        addNahBtns("ytd-compact-video-renderer #dismissible .details");
    }, 2000);

    const styleEl = document.createElement("style");
    styleEl.textContent = `
        .nah-btn {
            position: absolute;
            right: 0px;
            background: none;
            border: none;
            cursor: pointer;
            opacity: 0.5;
            color: #f1f1f1;
        }
        .nah-btn:hover {
            opacity: 1;
        }

        .btn-top {
            top: 45px;
        }

        .btn-bottom {
            top: 65px;
        }

        .hide-popup {
            opacity: 0;
            display: none;
        }
    `;
    document.head.appendChild(styleEl);

    function getFromStorage(key) {
        return new Promise((resolve, reject) => {
            // Check if chrome extension context is still valid
            if (!chrome || !chrome.runtime || !chrome.runtime.id) {
                console.error(
                    "Extension context invalidated - please refresh page",
                );
                resolve(false); // Return default value
                return;
            }

            // browser compatibility
            (typeof browser !== "undefined"
                ? browser.storage
                : chrome.storage
            ).sync.get(key, (result) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(result[key]);
                }
            });
        });
    }

    async function logger(...data) {
        const isDebuggingEnabled = await getFromStorage("isDebuggingEnabled");
        if (isDebuggingEnabled) {
            console.log("nah.js -", ...data);
        }
    }

    async function addNahBtns(videoBoxSelector) {
        const nahButtonLabel = (await getFromStorage("nahButtonLabel")) || "👎";
        const nahButton = {
            onClick: actionNah("nah"),
            cssClass: "btn-top",
            textContent: nahButtonLabel,
            title: "Not interested",
        };
        const channelButtonLabel =
            (await getFromStorage("channelButtonLabel")) || "❌";
        const channelButton = {
            onClick: actionNah("channel"),
            cssClass: "btn-bottom",
            textContent: channelButtonLabel,
            title: "Don't recommend channel",
        };
        const btnsToAdd = [];
        const shouldHideNahButtonUserPreference = await getFromStorage(
            "shouldHideNahButton",
        );
        const shouldHideChannelButtonUserPreference = await getFromStorage(
            "shouldHideChannelButton",
        );
        if (!shouldHideNahButtonUserPreference) {
            btnsToAdd.push(nahButton);
        }
        const isSubscriptionsPage =
            window.location.pathname === "/feed/subscriptions";
        if (!shouldHideChannelButtonUserPreference && !isSubscriptionsPage) {
            btnsToAdd.push(channelButton);
        }

        const fontSizeStorage = await getFromStorage("fontSize");
        const fontSize = fontSizeStorage ? `${fontSizeStorage}px` : null;

        try {
            for (const btnToAdd of btnsToAdd) {
                document
                    .querySelectorAll(videoBoxSelector)
                    .forEach((vidBox) => {
                        if (
                            vidBox.querySelector(
                                `button.${btnToAdd.cssClass}`,
                            ) != null
                        )
                            return; // if this vidBox has buttons already, can return early

                        const button = document.createElement("button");
                        button.classList.add("nah-btn");
                        button.classList.add(btnToAdd.cssClass);
                        button.textContent = btnToAdd.textContent;
                        button.onclick = btnToAdd.onClick;
                        button.title = btnToAdd.title;
                        if (fontSize) button.style.fontSize = fontSize;
                        vidBox.appendChild(button);
                    });
            }
        } catch (err) {
            console.error(err);
        }
    }

    function isMatchingButton(actionType, candidateLabel, labels) {
        const langLabels = labels[pageLang] ?? labels[pageLang.split("-")[0]];
        return !!(
            langLabels?.[actionType] &&
            langLabels[actionType].toLowerCase() ===
                candidateLabel.toLowerCase()
        );
    }

    function actionNah(actionType) {
        return async (event) => {
            event.preventDefault();
            // Don't stop propagation - it breaks YouTube's event handling

            // prevent popup from appearing when custom button is pressed
            const popupWrapper = document.querySelector("ytd-popup-container");
            logger("popupWrapper", popupWrapper);
            popupWrapper.classList.add("hide-popup");
            const menuButtonSelectors = [
                // subscriptions page
                "#menu #button yt-icon",

                // homepage, recommended videos
                ".ytLockupMetadataViewModelMenuButton button",
            ];
            const menuButton = event.target.parentElement.querySelector(
                menuButtonSelectors.join(","),
            );

            if (!menuButton) {
                logger("Could not find menu button");
                return;
            }

            logger("actionNah pressing button");
            await clickButton(menuButton);

            const MAX_RETRIES = 10;
            const INITIAL_DELAY_MS = 20;
            const BACKOFF_BASE_MS = 20;

            const tryFindAndClick = async (attempt) => {
                // when navigating between pages, a new copy of the virtual list is added to popupWrapper children
                // we want the most recent (i.e. last in the list)
                const popupWrapperInner = popupWrapper.querySelector(
                    "tp-yt-iron-dropdown:last-of-type",
                );
                const popupSelectors = [
                    // subscriptions
                    "ytd-menu-popup-renderer #items",

                    // homepage, recommended videos
                    "yt-list-view-model",
                ];
                const popupNode = popupWrapperInner?.querySelector(
                    popupSelectors.join(","),
                );

                logger(`Attempt ${attempt + 1}`, "popupNode", popupNode);

                if (!popupNode) {
                    logger(
                        `Attempt ${attempt + 1} - Could not find popup menu in DOM`,
                    );
                    return false;
                }

                let foundChild = null;
                const popupMenuChildren = Array.from(popupNode.children);

                logger("Scanning through popupMenuChildren:");
                for (let i = popupMenuChildren.length - 1; i >= 0; i--) {
                    const childNode = popupMenuChildren[i];
                    logger(i, childNode.outerHTML);
                    const candidateLabel = childNode.textContent.trim();

                    logger("candidate label:", candidateLabel);

                    const isCandidateCorrectButton = isMatchingButton(
                        actionType,
                        candidateLabel,
                        getActiveLabels(),
                    );
                    if (isCandidateCorrectButton) {
                        logger(`found popupMenuChildren button at index ${i}`);
                        foundChild = childNode;
                        break;
                    }
                }

                if (!foundChild) {
                    logger("Could not find button in popupMenuChildren");
                    return false;
                }

                // Prefer a button[role="menuitem"] inside the child (yt-list-view-model style);
                // fall back to the child itself (ytd-menu-service-item-renderer style).
                const notInterestedBtn =
                    foundChild.querySelector('button[role="menuitem"]') ??
                    foundChild;
                logger("notInterestedBtn", notInterestedBtn);

                if (notInterestedBtn) {
                    logger("clicking", notInterestedBtn.textContent.trim());
                    clickButton(notInterestedBtn);

                    const videoPreview =
                        document.querySelector("ytd-video-preview");
                    videoPreview.hidden = true;
                    return true;
                } else {
                    logger("could not find notInterestedBtn");
                    return false;
                }
            };

            try {
                for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                    const delay =
                        attempt === 0
                            ? INITIAL_DELAY_MS
                            : BACKOFF_BASE_MS * Math.pow(2, attempt);
                    await new Promise((r) => setTimeout(r, delay));
                    if (await tryFindAndClick(attempt)) break;
                }
            } finally {
                logger("removing hide class from popup wrapper");
                popupWrapper.classList.remove("hide-popup");
            }

            return false;
        };
    }
})();
