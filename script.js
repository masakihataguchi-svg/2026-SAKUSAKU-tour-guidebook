// スケジュールデータを格納する変数
let scheduleData = [];
let displayIndex = 0;
let isAutoMode = true;
let watchId = null;
// 通知済みリスト（重複通知防止用）
let notifiedList = JSON.parse(localStorage.getItem('notifiedList')) || [];

// --- 機能0: データ読み込み ---
async function loadSchedule() {
    console.log("★最新版JS読み込み成功: 通知デバッグ強化版★");
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
            
            const cleanRow = row.replace(/"/g, ''); 
            const columns = cleanRow.split(',');

            // 列特定ロジック
            // 「2026」が含まれる列をTime列(tIdx)とみなす
            let tIdx = 0;
            if (columns[2] && columns[2].indexOf('2026') > -1) {
                tIdx = 2; // 通常はC列
            } else {
                tIdx = columns.findIndex(col => col && col.indexOf('2026') > -1);
            }

            if (tIdx === -1) return null;

            // データマッピング
            // tIdx(Time)を基準に相対的に取得
            // A列(Mode) = tIdx - 2
            let modeRaw = (tIdx >= 2 && columns[tIdx - 2]) ? columns[tIdx - 2].trim().toLowerCase() : "other";
            if(modeRaw === "") modeRaw = "other";

            // B列(Status) = tIdx - 1
            const statusText = (tIdx >= 1 && columns[tIdx - 1]) ? columns[tIdx - 1].trim() : "";
            
            const time = columns[tIdx].trim();
            const title = columns[tIdx + 1] ? columns[tIdx + 1].trim() : "";
            const detail = columns[tIdx + 2] ? columns[tIdx + 2].trim() : "";
            
            const parseMulti = (descRaw, urlRaw) => {
                const descs = descRaw ? descRaw.split('\n').map(s => s.trim()) : [];
                const urls = urlRaw ? urlRaw.split('\n').map(s => s.trim()) : [];
                const results = [];
                urls.forEach((url, i) => {
                    if(url.startsWith('http')) results.push({ url: url, desc: descs[i] || "" });
                });
                return results;
            };

            const webLinks = parseMulti(columns[tIdx + 3], columns[tIdx + 4]);
            const images   = parseMulti(columns[tIdx + 5], columns[tIdx + 6]);

            // 通知データ (Time列から見て +7, +8 の位置)
            const notifyTime = columns[tIdx + 7] ? columns[tIdx + 7].trim() : "";
            const notifyMsg  = columns[tIdx + 8] ? columns[tIdx + 8].trim() : "";

            return { time, title, detail, webLinks, images, mode: modeRaw, statusText, notifyTime, notifyMsg };
        }).filter(item => item !== null);

        // 初期表示位置
        const now = new Date();
        const nextIdx = scheduleData.findIndex(item => new Date(item.time).getTime() > now.getTime());
        if (nextIdx !== -1) displayIndex = nextIdx;
        else displayIndex = scheduleData.length - 1;

        updateTimeKeeper();
        renderScheduleList(); 
        setupSwipe();
        checkNotificationPermission(); // 許可状態の確認

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
        
        let statusIcon = '<i class="fas fa-circle" style="font-size:0.5em; vertical-align:middle;"></i>';
        let iconColor = "#999"; 

        if (item.mode.includes('moving')) { statusIcon = '<i class="fas fa-bolt"></i>'; iconColor = "#ff4444"; }
        else if (item.mode.includes('transfer')) { statusIcon = '<i class="fas fa-walking"></i>'; iconColor = "#f39c12"; }
        else if (item.mode.includes('stay')) { statusIcon = '<i class="fas fa-map-pin"></i>'; iconColor = "#2ecc71"; }
        else if (item.mode.includes('prep')) { statusIcon = '<i class="fas fa-clipboard-list"></i>'; iconColor = "#9b59b6"; }
        else if (item.mode.includes('departure')) { statusIcon = '<i class="fas fa-train"></i>'; iconColor = "#0055a4"; }

        let linkIcon = "";
        if (item.webLinks.length > 0) linkIcon = ` <i class="fas fa-external-link-alt" style="color:#0055a4; margin-left:5px; font-size:0.8em;"></i>`;
        
        let bellIcon = "";
        if (item.notifyTime) bellIcon = ` <i class="fas fa-bell" style="color:#ffd700; margin-left:5px; font-size:0.8em;"></i>`;

        li.innerHTML = `<span class="time">${timePart}</span> 
                        <span style="color:${iconColor}; width:20px; display:inline-block; text-align:center; margin-right:5px;">${statusIcon}</span>
                        ${item.title}${linkIcon}${bellIcon}`;
        
        li.onclick = () => jumpToCard(index);
        li.style.cursor = "pointer";
        ul.appendChild(li);
    });
}

// --- 機能2: タイムキーパー ---
function updateTimeKeeper() {
    if (scheduleData.length === 0) return;
    const item = scheduleData[displayIndex];
    if (!item) return;

    const now = new Date();
    const eventTime = new Date(item.time);
    const diffMs = eventTime - now; 
    
    // UI取得
    const statusLabel = document.getElementById('status-label');
    const statusDesc = document.getElementById('status-description');
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
    webContainer.innerHTML = ""; mediaContent.innerHTML = ""; 
    speedSection.style.display = "none";

    // ラベル
    if (diffMs < 0) {
        statusLabel.innerText = "FINISHED"; statusLabel.style.color = "#ccc";
    } else if (isAutoMode && diffMs > 0) {
        statusLabel.innerText = "NEXT SCHEDULE"; statusLabel.style.color = "white";
    } else {
        statusLabel.innerText = "FUTURE EVENT"; statusLabel.style.color = "#88ccff";
    }

    statusDesc.innerText = item.statusText || "";
    const timeString = item.time.split(' ')[1] || '';
    nextEventDisplay.innerHTML = `<span class="event-time">${timeString}</span><span class="event-title">${item.title}</span>`;
    nextDetailDisplay.innerText = item.detail || "";
    cardCounter.innerText = `${displayIndex + 1} / ${scheduleData.length}`;

    // Mode分岐
    if (item.mode.includes('moving')) {
        speedSection.style.display = "block";
        renderWebLinks(item, webContainer, "経路・マップ");
        renderImages(item, imageContainer, mediaContent, "観光ガイド・車窓");
    } else {
        if (watchId !== null) stopGPS();
        let defaultWebLabel = "Webサイトを開く";
        let defaultImgLabel = "画像情報";
        if (item.mode.includes('transfer')) { defaultWebLabel = "構内図・地図を見る"; defaultImgLabel = "座席表 / 時刻表"; }
        else if (item.mode.includes('stay')) { defaultWebLabel = "公式サイト / 詳細"; defaultImgLabel = "ガイドマップ"; }
        else if (item.mode.includes('prep')) { defaultWebLabel = "天気・情報を確認"; defaultImgLabel = "持ち物 / 朝食情報"; }
        renderWebLinks(item, webContainer, defaultWebLabel);
        renderImages(item, imageContainer, mediaContent, defaultImgLabel);
    }

    // カウントダウン
    const absDiffMs = Math.abs(diffMs);
    const diffDays = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));
    const diffHrs = Math.floor((absDiffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMins = Math.floor((absDiffMs % (1000 * 60 * 60)) / (1000 * 60));
    let timeText = diffDays > 0 ? `${diffDays}日 ${diffHrs}時間` : diffHrs > 0 ? `${diffHrs}時間 ${diffMins}分` : `${diffMins}分`;
    if (diffMs < 0) {
        timeRemainingDisplay.innerText = `${timeText} 前`; timeRemainingDisplay.style.color = "#ccc";
    } else {
        timeRemainingDisplay.innerText = `あと ${timeText}`;
        timeRemainingDisplay.style.color = (diffMs < 1000 * 60 * 30 && diffDays === 0 && diffHrs === 0) ? "#ff4444" : "#ffd700";
    }
    
    document.querySelector('.left-arrow').style.display = (displayIndex === 0) ? 'none' : 'block';
    document.querySelector('.right-arrow').style.display = (displayIndex === scheduleData.length - 1) ? 'none' : 'block';
}

function renderWebLinks(item, container, defaultLabel) {
    if (item.webLinks && item.webLinks.length > 0) {
        container.style.display = "block";
        item.webLinks.forEach(link => {
            const btn = document.createElement('a');
            btn.className = 'event-link-btn'; btn.href = link.url; btn.target = "_blank"; btn.style.marginTop = "10px"; 
            const btnText = link.desc || defaultLabel;
            btn.innerHTML = `<i class="fas fa-external-link-alt"></i> ${btnText}`;
            container.appendChild(btn);
        });
    }
}
function renderImages(item, container, contentArea, defaultLabel) {
    if (item.images && item.images.length > 0) {
        container.style.display = "block";
        const descElem = document.getElementById('image-desc');
        if(descElem) descElem.innerText = item.images[0].desc || defaultLabel;
        item.images.forEach(img => {
            const driveMatch = img.url.match(/\/d\/(.+?)\//);
            let imgSrc = img.url;
            if (driveMatch) imgSrc = `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=s4000`;
            const imgTag = document.createElement('img');
            imgTag.src = imgSrc; imgTag.className = 'event-image'; imgTag.alt = img.desc || "Event Image"; imgTag.style.marginBottom = "10px";
            imgTag.onclick = () => openModal(imgSrc, img.desc || defaultLabel);
            contentArea.appendChild(imgTag);
        });
    }
}

// --- 機能6: 通知システム (デバッグ機能付き) ---
function requestNotificationPermission() {
    // 1. ブラウザ対応チェック
    if (!("Notification" in window)) {
        alert("【エラー】このブラウザは通知機能に対応していません。\n(iOSの場合はiOS 16.4以上が必要です)");
        return;
    }

    // 2. 現在のステータスチェック
    if (Notification.permission === "granted") {
        alert("通知は既に許可されています。\nテスト通知を送信します。");
        new Notification("テスト通知", { body: "通知機能は正常です！" });
        checkNotificationPermission();
        return;
    }

    if (Notification.permission === "denied") {
        alert("【通知がブロックされています】\nブラウザまたはスマホの設定から、このアプリの通知を許可してください。");
        return;
    }

    // 3. 許可をリクエスト
    alert("通知の許可をリクエストします...\n(この後表示されるポップアップで「許可」を押してください)");

    try {
        Notification.requestPermission().then(permission => {
            alert("リクエスト結果: " + permission); // デバッグ用

            if (permission === "granted") {
                checkNotificationPermission();
                new Notification("設定完了", { body: "通知がONになりました！" });
            } else {
                alert("通知が許可されませんでした。");
            }
        });
    } catch (e) {
        alert("エラーが発生しました: " + e);
    }
}

function checkNotificationPermission() {
    const statusText = document.getElementById('notify-status');
    const btn = document.getElementById('notify-btn');
    if (!statusText || !btn) return;

    if (!("Notification" in window)) {
        statusText.innerText = "通知機能: 非対応";
        btn.disabled = true;
        return;
    }

    if (Notification.permission === "granted") {
        statusText.innerText = "通知設定: 許可済み (OK)";
        statusText.style.color = "#88ff88";
        btn.innerHTML = '<i class="fas fa-bell"></i> 設定済み';
        btn.style.opacity = "0.5";
    } else if (Notification.permission === "denied") {
        statusText.innerText = "通知設定: ブロックされています";
        statusText.style.color = "#ff8888";
    } else {
        statusText.innerText = "通知設定: 未設定";
    }
}

function checkAndNotify() {
    if (Notification.permission !== "granted") return;

    const now = new Date();
    
    scheduleData.forEach(item => {
        if (!item.notifyTime || !item.notifyMsg) return;

        const targetTime = new Date(item.notifyTime);
        const diff = now.getTime() - targetTime.getTime();

        // ターゲット時間の前後1分以内(60000ms)、かつまだ通知していない場合
        if (diff >= 0 && diff < 60000) {
            const notifyKey = item.notifyTime + item.notifyMsg;
            if (!notifiedList.includes(notifyKey)) {
                
                new Notification("Hokkaido 2026", {
                    body: item.notifyMsg,
                    icon: "https://cdn-icons-png.flaticon.com/512/64/64572.png"
                });

                notifiedList.push(notifyKey);
                localStorage.setItem('notifiedList', JSON.stringify(notifiedList));
            }
        }
    });
}


// 共通・イベントリスナー
function changeCard(direction) {
    const newIndex = displayIndex + direction;
    if (newIndex >= 0 && newIndex < scheduleData.length) {
        displayIndex = newIndex; isAutoMode = false;
        const swipeArea = document.getElementById('swipe-area');
        swipeArea.classList.remove('fade-in'); void swipeArea.offsetWidth; swipeArea.classList.add('fade-in');
        updateTimeKeeper();
    }
}
function jumpToCard(index) {
    displayIndex = index; isAutoMode = false;
    switchTab('home'); updateTimeKeeper(); window.scrollTo({ top: 0, behavior: 'smooth' });
}
function setupSwipe() {
    const swipeArea = document.getElementById('time-keeper');
    let startX = 0; let endX = 0;
    swipeArea.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
    swipeArea.addEventListener('touchmove', (e) => { endX = e.touches[0].clientX; }, { passive: true });
    swipeArea.addEventListener('touchend', () => {
        if (startX === 0 || endX === 0) return;
        const diff = startX - endX;
        if (diff > 50) changeCard(1); else if (diff < -50) changeCard(-1);
        startX = 0; endX = 0;
    });
}
function toggleGPS() { if (watchId === null) startGPS(); else stopGPS(); }
function startGPS() {
    if (!navigator.geolocation) { alert("GPS非対応です"); return; }
    const btn = document.getElementById('gps-btn'); const display = document.getElementById('speed-display'); const status = document.getElementById('gps-status');
    btn.classList.add('active'); btn.innerHTML = '<i class="fas fa-stop"></i> 計測ストップ'; display.style.display = 'block'; status.innerText = "GPS信号を探しています...";
    watchId = navigator.geolocation.watchPosition(
        (pos) => {
            const speedKmh = pos.coords.speed ? (pos.coords.speed * 3.6).toFixed(0) : 0;
            document.getElementById('current-speed').innerText = speedKmh;
            status.innerText = `精度: ±${Math.round(pos.coords.accuracy)}m (更新中)`;
        },
        (err) => { console.error(err); status.innerText = "GPS信号が弱いか、権限がありません"; },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}
function stopGPS() {
    if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
    const btn = document.getElementById('gps-btn'); const display = document.getElementById('speed-display');
    if(btn) { btn.classList.remove('active'); btn.innerHTML = '<i class="fas fa-tachometer-alt"></i> 速度計測スタート'; }
    if(display) { display.style.display = 'none'; }
}
function openModal(src, caption) {
    const modal = document.getElementById("image-modal");
    document.getElementById("modal-img").src = src; document.getElementById("caption").innerText = caption || "";
    modal.style.display = "block"; document.getElementById("modal-img").classList.remove("zoomed");
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
    // 1分ごとに更新＆通知チェック
    setInterval(() => {
        if (isAutoMode) {
             const now = new Date();
             const nextIdx = scheduleData.findIndex(item => new Date(item.time).getTime() > now.getTime());
             if (nextIdx !== -1 && nextIdx !== displayIndex) displayIndex = nextIdx;
        }
        updateTimeKeeper();
        checkAndNotify(); // 通知チェック
    }, 60000); // 60秒ごと
    
    // アプリを開いた瞬間に1回チェック
    setTimeout(checkAndNotify, 3000);
});
