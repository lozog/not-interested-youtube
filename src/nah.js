// keep running so when new videos appear, ie. on page scroll, we add button to them as well
setInterval(() => {
    addNahBtns("ytd-rich-grid-media #details");
    addNahBtns("ytd-compact-video-renderer #dismissible .details");
    addNahBtns("ytd-rich-item-renderer .yt-lockup-metadata-view-model-wiz__menu-button");
    addNahBtns("yt-lockup-view-model .yt-lockup-metadata-view-model-wiz__menu-button");
}, 2000);

const baseStyles = `
<style>
    .nah-btn {
        position: absolute;
        right: 0px;
        background: none;
        border: none;
        cursor: pointer;
        opacity: 0.5;
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
</style>`;
document.head.insertAdjacentHTML("beforeend", baseStyles);

// browser compatibility
const storage =
    typeof browser !== "undefined" ? browser.storage : chrome.storage;

function getFromStorage(key) {
    return new Promise((resolve, reject) => {
        storage.sync.get(key, (result) => {
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
        console.log("nah -", ...data);
    }
}

async function addNahBtns(videoBoxSelector) {
    const nahButton = {
        onClick: actionNah(
            "M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2zM3 12c0 2.31.87 4.41 2.29 6L18 5.29C16.41 3.87 14.31 3 12 3c-4.97 0-9 4.03-9 9zm15.71-6L6 18.71C7.59 20.13 9.69 21 12 21c4.97 0 9-4.03 9-9 0-2.31-.87-4.41-2.29-6z"
        ),
        cssClass: "btn-top",
        textContent: "👎",
    };
    const channelButton = {
        onClick: actionNah(
            "M12 3c-4.96 0-9 4.04-9 9s4.04 9 9 9 9-4.04 9-9-4.04-9-9-9m0-1c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2zm7 11H5v-2h14v2z"
        ),
        cssClass: "btn-bottom",
        textContent: "❌",
    };
    const btnsToAdd = [];
    const shouldHideNahButton = await getFromStorage("shouldHideNahButton");
    const shouldHideChannelButton = await getFromStorage(
        "shouldHideChannelButton"
    );
    if (!shouldHideNahButton) {
        btnsToAdd.push(nahButton);
    }
    if (!shouldHideChannelButton) {
        btnsToAdd.push(channelButton);
    }

    try {
        for (const btnToAdd of btnsToAdd) {
            document.querySelectorAll(videoBoxSelector).forEach((vidBox) => {
                if (vidBox.querySelector(`button.${btnToAdd.cssClass}`) != null)
                    return; // if this vidBox has buttons already, can return early

                const button = document.createElement("button");
                button.classList.add("nah-btn");
                button.classList.add(btnToAdd.cssClass);
                button.textContent = btnToAdd.textContent;
                button.onclick = btnToAdd.onClick;
                vidBox.appendChild(button);
            });
        }
    } catch (err) {
        console.error(err);
    }
}

function actionNah(svgPath) {
    return (event) => {
        event.preventDefault();
        event.stopPropagation();

        // prevent popup from appearing when custom button is pressed
        const popupWrapper = document.querySelector("ytd-popup-container");
        popupWrapper.classList.add("hide-popup");
        event.target.parentElement
            .querySelector("#menu #button yt-icon")
            .click();

        // ..wait for popup to render using artificial delay
        setTimeout(async () => {
            const popupNode = popupWrapper.querySelector(
                `ytd-menu-popup-renderer #items`
            );
            if (!popupNode) {
                logger("Could not find popup menu in DOM");
                return;
            }
            let buttonChildIndex;
            const popupMenuChildren = Array.from(popupNode.children);
            for (let i = 0; i < popupMenuChildren.length; i++) {
                const childNode = popupMenuChildren[i];
                const svgCandidate = childNode.querySelector(
                    "ytd-menu-service-item-renderer tp-yt-paper-item yt-icon span div svg"
                );
                logger(childNode);
                logger(childNode.textContent.trim());
                logger(svgCandidate);
                if (!svgCandidate) continue;
                logger(svgCandidate.innerHTML);
                const isCandidateCorrectButton = svgCandidate.innerHTML
                    .trim()
                    .indexOf(svgPath);
                if (isCandidateCorrectButton !== -1) {
                    logger(`found button at index ${i}`);
                    buttonChildIndex = i;
                    break;
                }
            }

            if (!buttonChildIndex) {
                logger("Could not find button in DOM");
                return;
            }
            // nth-child css selector index is 1-based
            buttonChildIndex += 1;

            const notInterestedBtn = popupWrapper.querySelector(
                `ytd-menu-popup-renderer #items > ytd-menu-service-item-renderer:nth-child(${buttonChildIndex})`
            );

            if (notInterestedBtn) {
                logger("clicking", notInterestedBtn.textContent.trim());
                notInterestedBtn.click();
            }
            popupWrapper.classList.remove("hide-popup");
        }, 100);

        return false;
    };
}
