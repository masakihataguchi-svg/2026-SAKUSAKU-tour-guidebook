// スケジュールデータを格納する変数
let scheduleData = [];
// 現在表示しているカードのインデックス番号
let displayIndex = 0;
// 自動更新モードかどうかのフラグ
let isAutoMode = true;
// GPS監視ID
let watchId = null;

// --- 機能0: データ読み込み ---
async function loadSchedule() {
    console.log("★最新版JS読み込み成功: 複数リンク対応版★");
    try {
        const configResp = await fetch("config.json?t=" + new Date().getTime());
        if (!configResp.ok) throw new Error("config.jsonが見つかりません");
        
        const config = await configResp.json();
        const sheetUrl = config.sheetUrl;

        const csvResp = await fetch(sheetUrl + "&t=" + new Date().getTime());
        if (!csvResp.ok) throw new Error(`CSV読込エラー: ${csvResp.status}`);
        
        const text = await csvResp.text();
        const rows = text.trim().split('\n');
        
        scheduleData = rows.map(row => {
            if (!row || row.trim() === "") return null;
            // CSVのダブルクォート処理（改行入りセル対策）
            // 簡易的な処理ですが、URL内の改行コードはLF(\n)として扱われることを想定
            const cleanRow = row.replace(/"/g, ''); 
            const columns = cleanRow.split(',');

            let tIdx = 0;
            if (columns[1] && columns[1].indexOf('2026') > -1) tIdx = 1; 
            if (columns[tIdx] === undefined || columns[tIdx].indexOf('2026') === -1) return null;

            const time = columns[tIdx].trim();
            const title = columns[tIdx + 1] ? columns[tIdx + 1].trim() : "";
            const detail = columns[tIdx + 2] ? columns[tIdx + 2].trim() : "";
            
            // ★複数対応：改行(\n)で分割して配列にするヘルパー関数
            const parseMulti = (descRaw, urlRaw) => {
                const descs = descRaw ? descRaw.split('\n').map(s => s.trim()) : [];
                const urls = urlRaw ? urlRaw.split('\n').map(s => s.trim()) : [];
                const results = [];
                // URLがある分だけループ
                urls.forEach((url, i) => {
                    if(url.startsWith('http')) {
                        results.push({
                            url: url,
                            desc: descs[i] || "" // 対応する説明がなければ空文字
                        });
                    }
                });
                return results;
            };

            const webLinks = parseMulti(columns[tIdx + 3], columns[tIdx + 4]);
            const images   = parseMulti(columns[tIdx + 5], columns[tIdx + 6]);
            
            // Status
            let statusRaw = columns[tIdx + 7] ? columns[tIdx + 7].trim().toLowerCase() : "other";
            if(statusRaw === "") statusRaw = "other";

            return { time, title, detail, webLinks, images, status: statusRaw };
        }).filter(item => item !== null);

        // 初期表示位置を決定
        const now = new Date();
        const nextIdx = scheduleData.findIndex(item => new Date(item.time).getTime() > now.getTime());
        
        if (nextIdx !== -1) {
            displayIndex = nextIdx;
        } else {
            displayIndex = scheduleData.length - 1;
        }

        updateTimeKeeper();
        renderScheduleList(); 
        setupSwipe();

    } catch (error) {
        console.error("読込エラー:", error);
        document.getElementById('next-event').innerText = "読込エラー";
    }
}

// --- 機能1: 日程表リストの描画 ---
function renderScheduleList() {
    const container = document.querySelector('#schedule .timeline');
    if (!container || scheduleData.length === 0) return;

    container.innerHTML = '';
    let currentDayStr = "";
    const firstDateObj = new Date(scheduleData[0].time.split(' ')[0]);

    scheduleData.forEach((item, index) => {
        const datePart = item.time.split(' ')[0];
        const timePart = item.time.split(' ')[1] || "";

        if (datePart !== currentDayStr) {
            currentDayStr = datePart;
            const thisDateObj = new Date(datePart);
            const diffTime = Math.abs(thisDateObj - firstDateObj);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
            const formattedDate = `${thisDateObj.getMonth() + 1}/${thisDateObj.getDate()}`;
            const dayCard = document.createElement('div');
            dayCard.className = 'day-card';
            dayCard.innerHTML = `<h3>Day ${diffDays} (${formattedDate})</h3><ul></ul>`;
            container.appendChild(dayCard);
        }

        const ul = container.lastElementChild.querySelector('ul');
        const li = document.createElement('li');
        
        // Statusアイコン
        let statusIcon = "";
        let iconColor = "#999"; 

        if (item.status.includes('moving')) {
            statusIcon = '<i class="fas fa-bolt"></i>'; 
            iconColor = "#ff4444";
        } else if (item.status.includes('transfer')) {
            statusIcon = '<i class="fas fa-walking"></i>';
            iconColor = "#f39c12";
        } else if (item.status.includes('stay')) {
            statusIcon = '<i class="fas fa-map-pin"></i>';
            iconColor = "#2ecc71";
        } else if (item.status.includes('prep')) {
            statusIcon = '<i class="fas fa-clipboard-list"></i>';
            iconColor = "#9b59b6";
        } else if (item.status.includes('departure')) {
            statusIcon = '<i class="fas fa-train"></i>';
            iconColor = "#0055a4";
        } else {
            statusIcon = '<i class="fas fa-circle" style="font-size:0.5em; vertical-align:middle;"></i>'; 
        }

        // Webリンクアイコン (複数ある場合は1つでもあれば表示)
        let linkIcon = "";
        if (item.webLinks.length > 0) {
            linkIcon = ` <i class="fas fa-external-link-alt" style="color:#0055a4; margin-left:5px; font-size:0.8em;"></i>`;
        }
        
        li.innerHTML = `<span class="time">${timePart}</span> 
                        <span style="color:${iconColor}; width:20px; display:inline-block; text-align:center; margin-right:5px;">${statusIcon}</span>
                        ${item.title}${linkIcon}`;
        
        li.onclick = () => jumpToCard(index);
        li.style.cursor = "pointer";
        ul.appendChild(li);
    });
}

// --- 機能2: タイムキーパー (複数表示対応版) ---
function updateTimeKeeper() {
    if (scheduleData.length === 0) return;

    const item = scheduleData[displayIndex];
    if (!item) return;

    const now = new Date();
    const eventTime = new Date(item.time);
    const diffMs = eventTime - now; 
    
    // UI要素取得
    const statusLabel = document.getElementById('status-label');
    const nextEventDisplay = document.getElementById('next-event');
    const nextDetailDisplay = document.getElementById('next-detail');
    const timeRemainingDisplay = document.getElementById('time-remaining');
    const cardCounter = document.getElementById('card-counter');

    const webContainer = document.getElementById('web-link-container');
    const imageContainer = document.getElementById('image-container');
    const mediaContent = document.getElementById('media-content');
    const speedSection = document.getElementById('speedometer-section');

    // リセット
    webContainer.style.display = "none";
    imageContainer.style.display = "none";
    webContainer.innerHTML = ""; // 中身をクリア
    mediaContent.innerHTML = ""; // 画像をクリア
    speedSection.style.display = "none";

    // ステータス表示
    if (diffMs < 0) {
        statusLabel.innerText = "FINISHED";
        statusLabel.style.color = "#ccc";
    } else if (isAutoMode && diffMs > 0) {
        statusLabel.innerText = "NEXT SCHEDULE";
        statusLabel.style.color = "white";
    } else {
        statusLabel.innerText = "FUTURE EVENT";
        statusLabel.style.color = "#88ccff";
    }

    // テキスト設定
    const timeString = item.time.split(' ')[1] || '';
    nextEventDisplay.innerHTML = `<span class="event-time">${timeString}</span><span class="event-title">${item.title}</span>`;
    nextDetailDisplay.innerText = item.detail || "";
    cardCounter.innerText = `${displayIndex + 1} / ${scheduleData.length}`;

    // ★Statusによる機能分岐
    if (item.status.includes('moving')) {
        speedSection.style.display = "block";
        // 移動中もリンクがあれば表示
        renderWebLinks(item, webContainer, "経路・マップ");
        renderImages(item, imageContainer, mediaContent, "観光ガイド・車窓");

    } else {
        if (watchId !== null) stopGPS();

        // デフォルトラベル決定
        let defaultWebLabel = "Webサイトを開く";
        let defaultImgLabel = "画像情報";

        if (item.status.includes('transfer')) {
            defaultWebLabel = "構内図・地図を見る";
            defaultImgLabel = "座席表 / 時刻表";
        } else if (item.status.includes('stay')) {
            defaultWebLabel = "公式サイト / 詳細";
            defaultImgLabel = "ガイドマップ";
        } else if (item.status.includes('prep')) {
            defaultWebLabel = "天気・情報を確認";
            defaultImgLabel = "持ち物 / 朝食情報";
        }

        renderWebLinks(item, webContainer, defaultWebLabel);
        renderImages(item, imageContainer, mediaContent, defaultImgLabel);
    }

    // カウントダウン
    const absDiffMs = Math.abs(diffMs);
    const diffDays = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));
    const diffHrs = Math.floor((absDiffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMins = Math.floor((absDiffMs % (1000 * 60 * 60)) / (1000 * 60));
    let timeText = "";
    if (diffDays > 0) timeText = `${diffDays}日 ${diffHrs}時間`;
    else if (diffHrs > 0) timeText = `${diffHrs}時間 ${diffMins}分`;
    else timeText = `${diffMins}分`;

    if (diffMs < 0) {
        timeRemainingDisplay.innerText = `${timeText} 前`;
        timeRemainingDisplay.style.color = "#ccc";
    } else {
        timeRemainingDisplay.innerText = `あと ${timeText}`;
        timeRemainingDisplay.style.color = (diffMs < 1000 * 60 * 30 && diffDays === 0 && diffHrs === 0) ? "#ff4444" : "#ffd700";
    }
    
    document.querySelector('.left-arrow').style.display = (displayIndex === 0) ? 'none' : 'block';
    document.querySelector('.right-arrow').style.display = (displayIndex === scheduleData.length - 1) ? 'none' : 'block';
}

// ★補助関数: Webリンクの描画（複数対応）
function renderWebLinks(item, container, defaultLabel) {
    if (item.webLinks && item.webLinks.length > 0) {
        container.style.display = "block";
        
        // ラベル（1つ目の項目の説明 or デフォルト）
        // 複数ある場合は、各ボタンの中にラベルを入れるので、全体のラベルは非表示または代表ラベルにする
        // ここではシンプルに、全体のラベルは表示せず、ボタンごとに文字を入れるスタイルにします
        
        item.webLinks.forEach(link => {
            const btn = document.createElement('a');
            btn.className = 'event-link-btn';
            btn.href = link.url;
            btn.target = "_blank";
            btn.style.marginTop = "10px"; // ボタン間の隙間
            
            // 説明があればそれを、なければデフォルトラベル
            const btnText = link.desc || defaultLabel;
            btn.innerHTML = `<i class="fas fa-external-link-alt"></i> ${btnText}`;
            
            container.appendChild(btn);
        });
    }
}

// ★補助関数: 画像の描画（複数対応）
function renderImages(item, container, contentArea, defaultLabel) {
    if (item.images && item.images.length > 0) {
        container.style.display = "block";
        
        // 画像エリア全体の説明ラベル（1つ目の説明を採用、なければデフォルト）
        // 複数画像がある場合はラベルをどうするか悩みますが、一旦「画像ブロック」として表示
        const labelP = document.createElement('p');
        labelP.className = 'block-label';
        labelP.innerText = item.images[0].desc || defaultLabel;
        // contentAreaはクリア済みなので、その上にラベルを追加したいが、
        // 構造上 image-container の直下にラベル、media-contentの中に画像を入れる
        
        // 既存のHTML構造を利用するため、DOM操作でラベルを更新
        const descElem = document.getElementById('image-desc');
        if(descElem) descElem.innerText = item.images[0].desc || defaultLabel;

        item.images.forEach(img => {
            const driveMatch = img.url.match(/\/d\/(.+?)\//);
            let imgSrc = img.url;
            if (driveMatch) {
                imgSrc = `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=s4000`;
            }
            
            const imgTag = document.createElement('img');
            imgTag.src = imgSrc;
            imgTag.className = 'event-image';
            imgTag.alt = img.desc || "Event Image";
            imgTag.style.marginBottom = "10px"; // 画像間の隙間
            imgTag.onclick = () => openModal(imgSrc, img.desc || defaultLabel);
            
            contentArea.appendChild(imgTag);
        });
    }
}

// --- 機能3〜共通機能 (変更なし) ---
function changeCard(direction) {
    const newIndex = displayIndex + direction;
    if (newIndex >= 0 && newIndex < scheduleData.length) {
        displayIndex = newIndex;
        isAutoMode = false;
        const swipeArea = document.getElementById('swipe-area');
        swipeArea.classList.remove('fade-in');
        void swipeArea.offsetWidth;
        swipeArea.classList.add('fade-in');
        updateTimeKeeper();
    }
}
function jumpToCard(index) {
    displayIndex = index;
    isAutoMode = false;
    switchTab('home');
    updateTimeKeeper();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
function setupSwipe() {
    const swipeArea = document.getElementById('time-keeper');
    let startX = 0;
    let endX = 0;
    swipeArea.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
    swipeArea.addEventListener('touchmove', (e) => { endX = e.touches[0].clientX; }, { passive: true });
    swipeArea.addEventListener('touchend', () => {
        if (startX === 0 || endX === 0) return;
        const diff = startX - endX;
        if (diff > 50) changeCard(1);
        else if (diff < -50) changeCard(-1);
        startX = 0; endX = 0;
    });
}
function toggleGPS() {
    if (watchId === null) startGPS();
    else stopGPS();
}
function startGPS() {
    if (!navigator.geolocation) { alert("GPS非対応です"); return; }
    const btn = document.getElementById('gps-btn');
    const display = document.getElementById('speed-display');
    const status = document.getElementById('gps-status');
    btn.classList.add('active');
    btn.innerHTML = '<i class="fas fa-stop"></i> 計測ストップ';
    display.style.display = 'block';
    status.innerText = "GPS信号を探しています...";
    watchId = navigator.geolocation.watchPosition(
        (position) => {
            const speedMs = position.coords.speed;
            let speedKmh = 0;
            if (speedMs !== null) speedKmh = (speedMs * 3.6).toFixed(0);
            document.getElementById('current-speed').innerText = speedKmh;
            const accuracy = Math.round(position.coords.accuracy);
            status.innerText = `精度: ±${accuracy}m (更新中)`;
        },
        (error) => { console.error("GPS Error:", error); status.innerText = "GPS信号が弱いか、権限がありません"; },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}
function stopGPS() {
    if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
    const btn = document.getElementById('gps-btn');
    const display = document.getElementById('speed-display');
    if(btn) { btn.classList.remove('active'); btn.innerHTML = '<i class="fas fa-tachometer-alt"></i> 速度計測スタート'; }
    if(display) { display.style.display = 'none'; }
}
function openModal(src, caption) {
    const modal = document.getElementById("image-modal");
    const modalImg = document.getElementById("modal-img");
    const captionText = document.getElementById("caption");
    modal.style.display = "block";
    modalImg.src = src;
    captionText.innerText = caption || "";
    modalImg.classList.remove("zoomed");
}
function closeModal() { document.getElementById("image-modal").style.display = "none"; }
document.getElementById("modal-img").addEventListener('click', function(e) { e.stopPropagation(); this.classList.toggle("zoomed"); });
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if(typeof event !== 'undefined' && event.currentTarget) event.currentTarget.classList.add('active');
}
function filterSpots() {
    const input = document.getElementById('searchBox');
    if (!input) return;
    const filter = input.value.toUpperCase();
    const li = document.getElementById('spotList').getElementsByTagName('li');
    for (let i = 0; i < li.length; i++) {
        const text = li[i].textContent || li[i].innerText;
        li[i].style.display = (text.toUpperCase().indexOf(filter) > -1) ? "" : "none";
    }
}
document.addEventListener('DOMContentLoaded', function() {
    loadSchedule();
    setInterval(() => {
        if (isAutoMode) {
             const now = new Date();
             const nextIdx = scheduleData.findIndex(item => new Date(item.time).getTime() > now.getTime());
             if (nextIdx !== -1 && nextIdx !== displayIndex) displayIndex = nextIdx;
        }
        updateTimeKeeper();
    }, 60000);
});
