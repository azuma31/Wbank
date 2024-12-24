// グローバル状態
let currentUser = null;
let transactions = [];
let updateInterval = null;

// API呼び出し関数
async function callApi(action, data, showLoadingIndicator = true) {
    try {
        if (showLoadingIndicator) {
            showLoading();
        }

        const formData = new URLSearchParams();
        formData.append('action', action);
        formData.append('data', JSON.stringify(data));

        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || '予期せぬエラーが発生しました');
        }
        return result.data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    } finally {
        if (showLoadingIndicator) {
            hideLoading();
        }
    }
}

// UI制御関数
function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function showMessage(message, isError = false) {
    const messageEl = document.getElementById('message');
    const messageText = document.getElementById('message-text');
    messageEl.classList.remove('hidden');
    messageEl.style.backgroundColor = isError ? 'var(--danger)' : 'var(--success)';
    messageText.textContent = message;
    setTimeout(() => {
        messageEl.classList.add('hidden');
    }, 3000);
}

// 画面表示制御
function showLogin() {
    stopAutoUpdate();
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('dashboard').classList.add('hidden');
}

function showRegister() {
    stopAutoUpdate();
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
    document.getElementById('dashboard').classList.add('hidden');
}

function showDashboard() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    updateDashboard();
    updateNavButtons();
    startAutoUpdate();
}

// アカウント管理
async function handleRegister(event) {
    event.preventDefault();
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;

    try {
        if (password !== confirmPassword) {
            throw new Error('パスワードが一致しません');
        }

        const result = await callApi('register', { username, password });
        showMessage('アカウントが作成されました。ログインしてください。');
        showLogin();
        event.target.reset();
    } catch (error) {
        showMessage(error.message, true);
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        hideLoading(); // 既存のローディング表示をクリア
        const userData = await callApi('login', { username, password }, true);
        currentUser = { ...userData, password };
        transactions = await callApi('getTransactions', {
            accountId: currentUser.accountId
        }, false);
        showDashboard();
        event.target.reset();
        showMessage(`ようこそ、${username}さん`);
    } catch (error) {
        showMessage(error.message, true);
    }
}

function handleLogout() {
    stopAutoUpdate();
    currentUser = null;
    transactions = [];
    showLogin();
    updateNavButtons();
    showMessage('ログアウトしました');
}

// 自動更新機能
function startAutoUpdate() {
    stopAutoUpdate();
    updateInterval = setInterval(async () => {
        if (currentUser) {
            try {
                const userData = await callApi('login', {
                    username: currentUser.username,
                    password: currentUser.password
                }, false);
                currentUser = { ...userData, password: currentUser.password };
                transactions = await callApi('getTransactions', {
                    accountId: currentUser.accountId
                }, false);
                updateDashboard(true);
            } catch (error) {
                console.error('Auto-update error:', error);
            }
        }
    }, 10000);
}

function stopAutoUpdate() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}

// 取引機能
async function handleTransfer(event) {
    event.preventDefault();
    const toAccountId = document.getElementById('transfer-to').value;
    const amount = parseInt(document.getElementById('transfer-amount').value);

    try {
        if (!currentUser) {
            throw new Error('ログインが必要です');
        }

        if (toAccountId === currentUser.accountId) {
            throw new Error('自分自身には送金できません');
        }

        if (amount <= 0) {
            throw new Error('送金額は1W以上を指定してください');
        }

        if (amount > currentUser.balance) {
            throw new Error('残高が不足しています');
        }

        const result = await callApi('transfer', {
            fromAccountId: currentUser.accountId,
            toAccountId,
            amount
        }, true);

        currentUser.balance = result.newBalance;
        transactions = await callApi('getTransactions', {
            accountId: currentUser.accountId
        }, false);
        updateDashboard();
        event.target.reset();
        showMessage('送金が完了しました');
    } catch (error) {
        showMessage(error.message, true);
    }
}

// ダッシュボード更新
function updateDashboard(isAutoUpdate = false) {
    if (!currentUser) return;

    // アカウント情報の更新
    document.getElementById('balance').textContent =
        currentUser.balance.toLocaleString();
    document.getElementById('account-id').textContent =
        currentUser.accountId;
    document.getElementById('username').textContent =
        currentUser.username;

    // 取引履歴の更新
    const transactionsList = document.getElementById('transactions');
    transactionsList.innerHTML = '';

    if (transactions.length === 0) {
        transactionsList.innerHTML = '<div class="transaction-item">取引履歴がありません</div>';
        return;
    }

    transactions.forEach(transaction => {
        const div = document.createElement('div');
        div.className = 'transaction-item';

        const isReceived = transaction.toAccountId === currentUser.accountId;
        const amount = transaction.amount.toLocaleString();
        const date = new Date(transaction.date).toLocaleString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        div.innerHTML = `
            <div class="transaction-details">
                <span class="transaction-date">${date}</span>
                <span class="transaction-amount ${isReceived ? 'received' : 'sent'}">
                    ${isReceived ? '+' : '-'}${amount} W
                </span>
            </div>
            <div class="transaction-party">
                ${isReceived ? '送金元' : '送金先'}: 
                ${isReceived ? transaction.fromName : transaction.toName}
                (${isReceived ? transaction.fromAccountId : transaction.toAccountId})
            </div>
        `;

        transactionsList.appendChild(div);
    });
}

function updateNavButtons() {
    const navButtons = document.getElementById('nav-buttons');
    if (currentUser) {
        navButtons.innerHTML = `
            <span class="username-display">${currentUser.username}</span>
            <button class="btn btn-outline" onclick="handleLogout()">ログアウト</button>
        `;
    } else {
        navButtons.innerHTML = `
            <button class="btn btn-outline" onclick="showLogin()">ログイン</button>
            <button class="btn" onclick="showRegister()">新規登録</button>
        `;
    }
}

// アカウントID関連
function copyAccountId() {
    const accountId = document.getElementById('account-id').textContent;
    navigator.clipboard.writeText(accountId)
        .then(() => showMessage('アカウントIDをコピーしました'))
        .catch(() => showMessage('コピーに失敗しました', true));
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    showLogin();
});

// グローバルエラーハンドリング
window.addEventListener('unhandledrejection', event => {
    console.error('Unhandled promise rejection:', event.reason);
    showMessage('エラーが発生しました', true);
});

window.onerror = function (message, source, line, column, error) {
    console.error('Global error:', { message, source, line, column, error });
    showMessage('エラーが発生しました', true);
    return false;
};