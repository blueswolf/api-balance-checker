jQuery(async () => {
    // 1. 构建 UI 界面 (已彻底移除抓取按钮，界面极致清爽)
    const extensionHtml = `
        <div class="extension-settings" id="api-balance-checker-settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>💰 API 余额查询</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content" style="padding: 10px;">
                    
                    <div style="margin-bottom: 12px;">
                        <label style="font-size: 13px; color: var(--SmartThemeBodyColor); font-weight: bold; margin-bottom: 5px; display: block;">接口地址 (Base URL)</label>
                        <input type="text" id="api_check_url" class="text_pole" placeholder="例如: https://api.yourdomain.com" style="width: 100%; box-sizing: border-box;">
                    </div>

                    <div style="margin-bottom: 15px;">
                        <label style="font-size: 13px; color: var(--SmartThemeBodyColor); font-weight: bold; margin-bottom: 5px; display: block;">
                            API 密钥 <span style="font-size: 11px; font-weight: normal; color: #10b981;">(本地加密保存)</span>
                        </label>
                        <input type="text" id="api_check_key" class="text_pole" placeholder="输入真实API密钥 (自动隐藏并显示后3位)" style="width: 100%; box-sizing: border-box;">
                    </div>
                    
                    <div class="menu_button interactable" id="btn_check_api_balance" style="white-space: nowrap !important; word-break: keep-all; width: 100%; display: flex; justify-content: center; align-items: center; padding: 10px; box-sizing: border-box; margin: 0;">
                        <i class="fa-solid fa-wallet" style="margin-right: 8px;"></i> 立即查询剩余额度
                    </div>
                    
                    <div id="api_balance_result" style="display: none; padding: 15px; margin-top: 15px; background: rgba(0,0,0,0.2); border: 1px solid var(--SmartThemeBorderColor, #555); border-radius: 8px; font-size: 14px;">
                    </div>
                </div>
            </div>
        </div>
    `;

    $('#extensions_settings').append(extensionHtml);

    // 2. 加解密与掩码工具
    const SECRET_SALT = "SillyTavern_API_Secret_2026"; 
    
    function encryptData(text) {
        if (!text) return "";
        let result = "";
        for (let i = 0; i < text.length; i++) {
            result += String.fromCharCode(text.charCodeAt(i) ^ SECRET_SALT.charCodeAt(i % SECRET_SALT.length));
        }
        return btoa(encodeURIComponent(result)); 
    }

    function decryptData(hash) {
        if (!hash) return "";
        try {
            let text = decodeURIComponent(atob(hash));
            let result = "";
            for (let i = 0; i < text.length; i++) {
                result += String.fromCharCode(text.charCodeAt(i) ^ SECRET_SALT.charCodeAt(i % SECRET_SALT.length));
            }
            return result;
        } catch (e) {
            return hash; 
        }
    }

    function getMaskedKey(key) {
        if (!key) return '';
        if (key.length <= 4) return '********'; 
        return '********' + key.slice(-3); 
    }

    // 3. 本地持久化与交互逻辑
    const STORAGE_KEY_URL = 'api_balance_ext_url';
    const STORAGE_KEY_KEY = 'api_balance_ext_key';
    
    let realApiKey = "";

    const savedUrl = localStorage.getItem(STORAGE_KEY_URL);
    const savedKeyEncrypted = localStorage.getItem(STORAGE_KEY_KEY);
    
    if (savedUrl) $('#api_check_url').val(savedUrl);
    if (savedKeyEncrypted) {
        realApiKey = decryptData(savedKeyEncrypted); 
        $('#api_check_key').val(getMaskedKey(realApiKey)); 
    }

    $('#api_check_url').on('input', function() { 
        localStorage.setItem(STORAGE_KEY_URL, $(this).val().trim()); 
    });

    $('#api_check_key').on('focus', function() { $(this).select(); });

    $('#api_check_key').on('blur', function() {
        const currentVal = $(this).val().trim();
        if (currentVal === '') {
            realApiKey = '';
            localStorage.removeItem(STORAGE_KEY_KEY);
        } else if (currentVal !== getMaskedKey(realApiKey)) {
            realApiKey = currentVal;
            localStorage.setItem(STORAGE_KEY_KEY, encryptData(realApiKey)); 
            $(this).val(getMaskedKey(realApiKey)); 
        } else {
            $(this).val(getMaskedKey(realApiKey));
        }
    });

    // 4. 执行查询逻辑
    $('#btn_check_api_balance').on('click', async function() {
        const btn = $(this);
        const resultBox = $('#api_balance_result');
        
        let apiUrl = $('#api_check_url').val().trim();
        const apiKey = realApiKey;

        if (!apiUrl) { toastr.warning('请填写接口地址！'); return; }
        if (!apiKey) { toastr.warning('请填写API密钥！'); return; }

        const originalBtnHtml = btn.html();
        btn.html('<i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i> 正在查询...');
        btn.css('pointer-events', 'none'); 
        resultBox.hide();

        apiUrl = apiUrl.replace(/\/+$/, '').replace(/\/v1$/, '');

        try {
            const subRes = await fetch(`${apiUrl}/v1/dashboard/billing/subscription`, { headers: { 'Authorization': `Bearer ${apiKey}` } });
            if (!subRes.ok) throw new Error(subRes.status === 401 ? "API Key 无效或已过期" : `请求失败 (状态码: ${subRes.status})`);
            
            const subData = await subRes.json();
            const totalAmount = subData.hard_limit_usd || 0;

            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const startDate = `${year}-${month}-01`;
            const endDate = `${year}-${month}-${String(today.getDate() + 1).padStart(2, '0')}`;

            let usedAmount = 0;
            try {
                const usageRes = await fetch(`${apiUrl}/v1/dashboard/billing/usage?start_date=${startDate}&end_date=${endDate}`, { headers: { 'Authorization': `Bearer ${apiKey}` } });
                if (usageRes.ok) {
                    const usageData = await usageRes.json();
                    usedAmount = usageData.total_usage ? usageData.total_usage / 100 : 0;
                }
            } catch (e) { }

            const remaining = Math.max(0, totalAmount - usedAmount);

            resultBox.html(`
                <div style="margin-bottom: 6px;"><span>总额度：</span> <b>$${totalAmount.toFixed(3)}</b></div>
                <div style="margin-bottom: 6px;"><span>已使用：</span> <b>$${usedAmount.toFixed(3)}</b></div>
                <hr style="border-color: rgba(255,255,255,0.1); margin: 10px 0;">
                <div style="font-size: 16px;"><span>剩余可用：</span> <b style="color: #4ade80;">$${remaining.toFixed(3)}</b></div>
            `).fadeIn();
            toastr.success('余额查询成功！');

        } catch (error) {
            resultBox.html(`<div style="color: #f87171;"><b>查询失败：</b><br>${error.message}</div>`).fadeIn();
            toastr.error('查询失败，请检查设置');
        } finally {
            btn.html(originalBtnHtml);
            btn.css('pointer-events', 'auto');
        }
    });
});
