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

    const LABELS = {
        "af-ZA": {
            nah: "Stel nie belang nie",
            channel: "Moenie kanaal aanbeveel nie",
        },
        "az-Latn-AZ": {
            nah: "Maraqlı deyil",
            channel: "Kanalı tövsiyə etməyin",
        },
        "id-ID": {
            nah: "Tidak tertarik",
            channel: "Jangan rekomendasikan channel",
        },
        "ms-MY": { nah: "Tidak berminat", channel: "Jangan cadangkan saluran" },
        "bs-Latn-BA": {
            nah: "Ne zanima me",
            channel: "Nemoj preporučiti kanal",
        },
        "ca-ES": {
            nah: "No m'interessa",
            channel: "No em recomanis aquest canal",
        },
        "cs-CZ": { nah: "Nezajímá mě", channel: "Nedoporučovat kanál" },
        "da-DK": { nah: "Ikke interesseret", channel: "Anbefal ikke kanal" },
        "de-DE": {
            nah: "Kein Interesse",
            channel: "Keine Videos von diesem Kanal empfehlen",
        },
        "et-EE": { nah: "Ei ole huvitatud", channel: "Ära soovita kanalit" },
        "en-IN": { nah: "Not interested", channel: "Don't recommend channel" },
        "en-GB": { nah: "Not interested", channel: "Don't recommend channel" },
        en: { nah: "Not interested", channel: "Don't recommend channel" },
        "es-ES": {
            nah: "No me interesa",
            channel: "No recomendarme este canal",
        },
        "es-419": { nah: "No me interesa", channel: "No recomendar el canal" },
        "es-US": { nah: "No me interesa", channel: "No recomendar el canal" },
        "eu-ES": {
            nah: "Ez zait interesatzen",
            channel: "Ez gomendatu kanala",
        },
        "fil-PH": {
            nah: "Hindi interesado",
            channel: "Huwag irekomenda ang channel",
        },
        "fr-FR": {
            nah: "Pas intéressé",
            channel: "Ne pas recommander la chaîne",
        },
        "fr-CA": {
            nah: "Pas intéressé",
            channel: "Ne pas recommander la chaîne",
        },
        "gl-ES": { nah: "Non me interesa", channel: "Non recomendar a canle" },
        "hr-HR": { nah: "Ne zanima me", channel: "Ne preporučuj mi taj kanal" },
        "zu-ZA": { nah: "Awunantshisekelo", channel: "Asisincomi isiteshi" },
        "is-IS": { nah: "Hef ekki áhuga", channel: "Ekki mæla með rás" },
        "sw-TZ": { nah: "Hainivutii", channel: "Usipendekeze chaneli" },
        "lv-LV": { nah: "Neesmu ieinteresēts", channel: "Neieteikt kanālu" },
        "lt-LT": { nah: "Nedomina", channel: "Nerekomenduoti kanalo" },
        "hu-HU": { nah: "Nem érdekel", channel: "Ne javasold ezt a csatornát" },
        "nl-NL": {
            nah: "Niet geïnteresseerd",
            channel: "Kanaal niet aanbevelen",
        },
        "nb-NO": {
            nah: "Ikke interessert",
            channel: "Ikke anbefal denne kanalen",
        },
        "uz-Latn-UZ": {
            nah: "Bu menga qiziq emas",
            channel: "Bu kanal tavsiya qilinmasin",
        },
        "pl-PL": {
            nah: "Nie interesuje mnie to",
            channel: "Nie polecaj kanału",
        },
        "pt-PT": { nah: "Sem interesse", channel: "Não recomendar canal" },
        "pt-BR": {
            nah: "Não tenho interesse",
            channel: "Não recomendar o canal",
        },
        "ro-RO": { nah: "Nu mă interesează", channel: "Nu recomanda canalul" },
        "sq-AL": {
            nah: "Nuk më intereson",
            channel: "Mos e rekomando kanalin",
        },
        "sk-SK": { nah: "Nemám záujem", channel: "Neodporúčať kanál" },
        "sl-SI": { nah: "Ne zanima me", channel: "Ne priporočaj kanala" },
        "sr-Latn-RS": { nah: "Ne zanima me", channel: "Ne preporučuj kanal" },
        "fi-FI": {
            nah: "En ole kiinnostunut",
            channel: "Älä suosittele kanavaa",
        },
        "sv-SE": {
            nah: "Inte intresserad",
            channel: "Rekommendera inte kanalen",
        },
        "vi-VN": { nah: "Không quan tâm", channel: "Không đề xuất kênh này" },
        "tr-TR": { nah: "İlgilenmiyorum", channel: "Kanalı önerme" },
        "be-BY": { nah: "Не цікавіць", channel: "Не рэкамендаваць канал" },
        "bg-BG": {
            nah: "Не проявявам интерес",
            channel: "Да не се препоръчва каналът",
        },
        "ky-KG": { nah: "Кызыксыз", channel: "Канал сунушталбасын" },
        "kk-KZ": { nah: "Қызықты емес", channel: "Арнаның бейнелерін ұсынбау" },
        "mk-MK": {
            nah: "Не ме интересира",
            channel: "Не препорачувај го каналот",
        },
        "mn-MN": { nah: "Сонирхохгүй", channel: "Суваг бүү санал болго" },
        "ru-RU": {
            nah: "Не интересует",
            channel: "Не рекомендовать видео с этого канала",
        },
        "sr-Cyrl-RS": { nah: "Не занима ме", channel: "Не препоручуј канал" },
        "uk-UA": { nah: "Не цікавить", channel: "Не рекомендувати канал" },
        "el-GR": {
            nah: "Δεν ενδιαφέρομαι",
            channel: "Να μην προτείνεται το κανάλι",
        },
        "hy-AM": {
            nah: "Չի հետաքրքրում",
            channel: "Չառաջարկել այս ալիքի տեսանյութերը",
        },
        "he-IL": {
            nah: "לא מעניין אותי",
            channel: "אני לא רוצה לקבל המלצה על הערוץ",
        },
        "ur-PK": { nah: "دلچسپی نہیں ہے", channel: "چینل کو تجویز نہ کریں" },
        ar: { nah: "لا يهمني", channel: "عدم اقتراح القناة" },
        "fa-IR": { nah: "علاقه‌مند نیستم", channel: "کانال توصیه نشود" },
        "ne-NP": { nah: "इच्छुक छैन", channel: "च्यानल सिफारिस गर्नुहोस्" },
        "mr-IN": { nah: "स्वारस्य नाही", channel: "चॅनलची शिफारस करू नका" },
        "hi-IN": { nah: "दिलचस्पी नहीं है", channel: "यह चैनल न सुझाएं" },
        "as-IN": { nah: "আগ্ৰহী নহয়", channel: "চেনেল চুপাৰিছ নকৰিব" },
        "bn-BD": {
            nah: "আগ্রহী নই",
            channel: "এই চ্যানেলের ভিডিও সাজেস্ট করবেন না",
        },
        "pa-Guru-IN": {
            nah: "ਦਿਲਚਸਪੀ ਨਹੀਂ",
            channel: "ਚੈਨਲ ਦੀ ਸਿਫ਼ਾਰਸ਼ ਨਾ ਕਰੋ",
        },
        "gu-IN": { nah: "રુચિ નથી", channel: "ચૅનલનો સુઝાવ આપશો નહીં" },
        "or-IN": {
            nah: "ଆଗ୍ରହ ନାହିଁ",
            channel: "ଚ୍ୟାନେଲ୍‍କୁ ସୁପାରିଶ କରନ୍ତୁ ନାହିଁ",
        },
        "ta-IN": { nah: "ஆர்வமில்லை", channel: "சேனலைப் பரிந்துரைக்காதே" },
        "te-IN": {
            nah: "ఆసక్తి లేనివి",
            channel: "ఛానెల్‌ను సిఫార్సు చేయవద్దు",
        },
        "kn-IN": {
            nah: "ಆಸಕ್ತಿ ಹೊಂದಿಲ್ಲ",
            channel: "ಈ ಚಾನಲ್ ಅನ್ನು ಶಿಫಾರಸು ಮಾಡಬೇಡಿ",
        },
        "ml-IN": { nah: "താൽപ്പര്യമില്ല", channel: "ചാനൽ നിർദ്ദേശിക്കരുത്" },
        "si-LK": { nah: "උනන්දුවක් නැති", channel: "නාලිකාව නිර්දේශ නොකරන්න" },
        "th-TH": { nah: "ไม่สนใจ", channel: "ไม่ต้องแนะนำช่อง" },
        "lo-LA": { nah: "ບໍ່ສົນໃຈ", channel: "ບໍ່ຕ້ອງແນະນຳຊ່ອງ" },
        "my-MM": {
            nah: "စိတ်မ၀င်စားပါ",
            channel: "ဤချန်နယ်ကို ကျွန်ုပ်အား အကြံမပြုပါနှင့်",
        },
        "ka-GE": {
            nah: "არ მაინტერესებს",
            channel: "არხისთვის რეკომენდაციის არგაწევა",
        },
        "am-ET": { nah: "ፍላጎት የለኝም", channel: "ሰርጥ አይምከሩ" },
        "km-KH": { nah: "មិន​ចាប់អារម្មណ៍", channel: "កុំ​ណែនាំ​ប៉ុស្តិ៍" },
        "zh-Hans-CN": { nah: "不感兴趣", channel: "不要推荐此频道" },
        "zh-Hant-TW": { nah: "不感興趣", channel: "不要推薦這個頻道" },
        "zh-Hant-HK": { nah: "沒有興趣", channel: "不推薦此頻道" },
        "ja-JP": {
            nah: "興味なし",
            channel: "チャンネルをおすすめに表示しない",
        },
        "ko-KR": { nah: "관심 없음", channel: "채널 추천 안함" },
    };

    // Labels for the subscriptions feed — different wording from the homepage.
    // Note: "Don't recommend channel" does not appear on the subscriptions feed.
    const SUBSCRIPTION_LABELS = {
        "af-ZA": { nah: "Versteek" },
        "az-Latn-AZ": { nah: "Gizlədin" },
        "id-ID": { nah: "Sembunyikan" },
        "ms-MY": { nah: "Sembunyikan" },
        "bs-Latn-BA": { nah: "Sakrij" },
        "ca-ES": { nah: "Amaga" },
        "cs-CZ": { nah: "Skrýt" },
        "da-DK": { nah: "Skjul" },
        "de-DE": { nah: "Ausblenden" },
        "et-EE": { nah: "Peida" },
        "en-IN": { nah: "Hide" },
        "en-GB": { nah: "Hide" },
        en: { nah: "Hide" },
        "es-ES": { nah: "Ocultar" },
        "es-419": { nah: "Ocultar" },
        "es-US": { nah: "Ocultar" },
        "eu-ES": { nah: "Ezkutatu" },
        "fil-PH": { nah: "Itago" },
        "fr-FR": { nah: "Masquer" },
        "fr-CA": { nah: "Masquer" },
        "gl-ES": { nah: "Ocultar" },
        "hr-HR": { nah: "Sakrij" },
        "zu-ZA": { nah: "Fihla" },
        "is-IS": { nah: "Fela" },
        "sw-TZ": { nah: "Ficha" },
        "lv-LV": { nah: "Paslēpt" },
        "lt-LT": { nah: "Slėpti" },
        "hu-HU": { nah: "Elrejtés" },
        "nl-NL": { nah: "Verbergen" },
        "nb-NO": { nah: "Skjul" },
        "uz-Latn-UZ": { nah: "Berkitish" },
        "pl-PL": { nah: "Ukryj" },
        "pt-PT": { nah: "Ocultar" },
        "pt-BR": { nah: "Ocultar" },
        "ro-RO": { nah: "Ascunde" },
        "sq-AL": { nah: "Fshih" },
        "sk-SK": { nah: "Skryť" },
        "sl-SI": { nah: "Skrij" },
        "sr-Latn-RS": { nah: "Sakrij" },
        "fi-FI": { nah: "Piilota" },
        "sv-SE": { nah: "Dölj" },
        "vi-VN": { nah: "Ẩn" },
        "tr-TR": { nah: "Gizle" },
        "be-BY": { nah: "Схаваць" },
        "bg-BG": { nah: "Скриване" },
        "ky-KG": { nah: "Жашыруу" },
        "kk-KZ": { nah: "Жасыру" },
        "mk-MK": { nah: "Скриј" },
        "mn-MN": { nah: "Нуух" },
        "ru-RU": { nah: "Скрыть" },
        "sr-Cyrl-RS": { nah: "Сакриј" },
        "uk-UA": { nah: "Сховати" },
        "el-GR": { nah: "Απόκρυψη" },
        "hy-AM": { nah: "Թաքցնել" },
        "he-IL": { nah: "הסתרה" },
        "ur-PK": { nah: "چھپائیں" },
        ar: { nah: "إخفاء" },
        "fa-IR": { nah: "پنهان کردن" },
        "ne-NP": { nah: "लुकाउनुहोस्" },
        "mr-IN": { nah: "लपवा" },
        "hi-IN": { nah: "छिपाएं" },
        "as-IN": { nah: "লুকুওৱা" },
        "bn-BD": { nah: "লুকান" },
        "pa-Guru-IN": { nah: "ਲੁਕਾਉ" },
        "gu-IN": { nah: "છુપાવો" },
        "or-IN": { nah: "ଲୁଚାନ୍ତୁ" },
        "ta-IN": { nah: "மறை" },
        "te-IN": { nah: "దాచు" },
        "kn-IN": { nah: "ಮರೆಮಾಡಿ" },
        "ml-IN": { nah: "മറയ്‌ക്കുക" },
        "si-LK": { nah: "සඟවන්න" },
        "th-TH": { nah: "ซ่อน" },
        "lo-LA": { nah: "ເຊື່ອງ" },
        "my-MM": { nah: "ဝှက်ထားရန်" },
        "ka-GE": { nah: "დამალვა" },
        "am-ET": { nah: "ይደብቁ" },
        "km-KH": { nah: "លាក់​" },
        "zh-Hans-CN": { nah: "隐藏" },
        "zh-Hant-TW": { nah: "隱藏" },
        "zh-Hant-HK": { nah: "隱藏" },
        "ja-JP": { nah: "非表示" },
        "ko-KR": { nah: "숨기기" },
    };

    const SVG_PATHS = {
        nah: "M12 1C5.925 1 1 5.925 1 12s4.925 11 11 11 11-4.925 11-11S18.075 1 12 1Zm0 2a9 9 0 018.246 12.605L4.755 6.661A8.99 8.99 0 0112 3ZM3.754 8.393l15.491 8.944A9 9 0 013.754 8.393Z",
        channel:
            "M12 1C5.925 1 1 5.925 1 12s4.925 11 11 11 11-4.925 11-11S18.075 1 12 1Zm0 2a9 9 0 110 18.001A9 9 0 0112 3Zm4 8H8a1 1 0 000 2h8a1 1 0 000-2Z",
    };

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

    const baseStyles = `
        <style>
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
        </style>`;
    document.head.insertAdjacentHTML("beforeend", baseStyles);

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

    function hasMatchingPath(svgElement, targetPath) {
        if (!svgElement) return false;
        const paths = svgElement.querySelectorAll("path");
        return Array.from(paths).some(
            (p) => p.getAttribute("d") === targetPath,
        );
    }

    function isMatchingButton(
        actionType,
        candidateLabel,
        candidateSvg,
        labels,
    ) {
        const langLabels = labels[pageLang] ?? labels[pageLang.split("-")[0]];

        if (
            langLabels?.[actionType] &&
            langLabels[actionType].toLowerCase() ===
                candidateLabel.toLowerCase()
        ) {
            logger("Label match");
            return true;
        }

        const isSvgMatch = hasMatchingPath(candidateSvg, SVG_PATHS[actionType]);
        logger("Nope, checking SVGs");
        if (isSvgMatch) {
            logger("SVG match");
            return true;
        }

        return false;
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

            // ..wait for popup to render using artificial delay
            setTimeout(async () => {
                try {
                    // when navigating between pages, a new copy of the virtual list is added to popupWrapper children
                    // we want the most recent (i.e. last in the last)
                    const popupWrapperInner = popupWrapper.querySelector(
                        "tp-yt-iron-dropdown:last-of-type",
                    );
                    const popupSelectors = [
                        // subscriptions
                        "ytd-menu-popup-renderer #items",

                        // homepage, recommended videos
                        "yt-list-view-model",
                    ];
                    const popupNode = popupWrapperInner.querySelector(
                        popupSelectors.join(","),
                    );
                    logger("popupNode", popupNode);

                    if (!popupNode) {
                        logger("Could not find popup menu in DOM");
                        return;
                    }

                    let buttonChildIndex = -1;
                    const popupMenuChildren = Array.from(popupNode.children);

                    logger("Scanning through popupMenuChildren:");
                    for (let i = 0; i < popupMenuChildren.length; i++) {
                        const childNode = popupMenuChildren[i];
                        logger(i, childNode.outerHTML);
                        const candidateLabel = childNode.textContent.trim();

                        logger("candidate label:", candidateLabel);

                        const candidateSvgSelectors = [
                            // subscriptions
                            "ytd-menu-service-item-renderer tp-yt-paper-item yt-icon span div svg",

                            // homepage, recommended videos
                            "yt-list-item-view-model svg",
                        ];
                        const candidateSvg = childNode.querySelector(
                            candidateSvgSelectors.join(","),
                        );

                        logger(
                            "candidate SVG:",
                            candidateSvg?.outerHTML ?? null,
                        );

                        const isCandidateCorrectButton = isMatchingButton(
                            actionType,
                            candidateLabel,
                            candidateSvg,
                            getActiveLabels(),
                        );
                        if (isCandidateCorrectButton) {
                            logger(
                                `found popupMenuChildren button at index ${i}`,
                            );
                            buttonChildIndex = i;
                            break;
                        }
                    }

                    if (buttonChildIndex === -1) {
                        logger("Could not find button in popupMenuChildren");
                        return;
                    }
                    // nth-child css selector index is 1-based
                    buttonChildIndex += 1;

                    const selectors = [
                        // subscriptions
                        `ytd-menu-popup-renderer #items > ytd-menu-service-item-renderer:nth-child(${buttonChildIndex})`,

                        // homepage, recommended videos
                        `:nth-child(${buttonChildIndex})`,
                    ];
                    const notInterestedBtn = popupNode.querySelector(
                        selectors.join(","),
                    );
                    logger("searching", selectors.join(","), popupNode);
                    logger("notInterestedBtn", notInterestedBtn);

                    if (notInterestedBtn) {
                        logger("clicking", notInterestedBtn.textContent.trim());
                        clickButton(notInterestedBtn);

                        // hide video preview
                        const videoPreview =
                            document.querySelector("ytd-video-preview");
                        videoPreview.hidden = true;
                    } else {
                        logger("could not find notInterestedBtn");
                    }
                } finally {
                    logger("removing hide class from popup wrapper");
                    popupWrapper.classList.remove("hide-popup"); // todo: control with display: none style
                    logger("done");
                }
            }, 50);

            return false;
        };
    }
})();
