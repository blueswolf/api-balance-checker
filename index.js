jQuery(async () => {
    // 候选请求地址列表（自动匹配 HTTP/HTTPS 及 8098 端口）
    const CANDIDATE_URLS = [
        'http://api01.kpk.dpdns.org:8098/api/stats',
        'http://156.238.224.176:8098/api/stats',
        'https://api01.kpk.dpdns.org:8098/api/stats'
    ];

    // 1. 构建 UI 界面 (简约大气，与酒馆原生主题 100% 融合)
    const extensionHtml = `
        <div class="extension-settings" id="api-balance-checker-settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>💰 API 余额与模型健康监控</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content" style="padding: 10px;">
                    
                    <!-- 💰 模块一：API 余额查询 -->
                    <div style="margin-bottom: 12px; background: rgba(0,0,0,0.12); padding: 10px; border-radius: 8px; border: 1px solid var(--SmartThemeBorderColor, rgba(255,255,255,0.1));">
                        <div style="font-size: 12px; font-weight: bold; color: var(--SmartThemeBodyColor); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-wallet" style="color: #f59e0b;"></i> 余额查询
                        </div>

                        <div style="margin-bottom: 6px;">
                            <input type="text" id="api_check_url" class="text_pole" placeholder="接口地址 (如: https://api.yourdomain.com)" style="width: 100%; box-sizing: border-box; font-size: 11px; padding: 4px 8px;">
                        </div>

                        <div style="margin-bottom: 8px;">
                            <input type="text" id="api_check_key" class="text_pole" placeholder="API 密钥 (加密保存)" style="width: 100%; box-sizing: border-box; font-size: 11px; padding: 4px 8px;">
                        </div>
                        
                        <div class="menu_button interactable" id="btn_check_api_balance" style="white-space: nowrap !important; word-break: keep-all; width: 100%; display: flex; justify-content: center; align-items: center; padding: 6px; box-sizing: border-box; margin: 0; font-size: 11px;">
                            <i class="fa-solid fa-coins" style="margin-right: 6px;"></i> 查询余额
                        </div>
                        
                        <div id="api_balance_result" style="display: none; padding: 8px; margin-top: 8px; background: rgba(0,0,0,0.2); border: 1px solid var(--SmartThemeBorderColor, #555); border-radius: 6px; font-size: 12px;">
                        </div>
                    </div>

                    <!-- 模块二：模型健康度分析（白字模型名，无冗余表头） -->
                    <div style="background: rgba(0,0,0,0.12); padding: 10px; border-radius: 8px; border: 1px solid var(--SmartThemeBorderColor, rgba(255,255,255,0.1));">
                        
                        <!-- 纯粹的刷新按钮 -->
                        <div class="menu_button interactable" id="btn_refresh_purple_brain" style="width: 100%; display: flex; justify-content: center; align-items: center; padding: 6px; margin: 0 0 10px 0; font-size: 11px;">
                            <i class="fa-solid fa-rotate-right" style="margin-right: 6px;"></i> 刷新模型健康统计
                        </div>

                        <!-- 🏆 成功几率最高 Top 3 -->
                        <div style="font-size: 11px; font-weight: bold; color: #4ade80; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
                            <span>🏆 成功几率最高 Top 3</span>
                            <span style="font-size: 10px; opacity: 0.7; font-weight: normal;">(Tokens > 1000)</span>
                        </div>
                        <div id="pb_top_success_list" style="margin-bottom: 10px;">
                            <div style="font-size: 11px; opacity: 0.6; text-align: center; padding: 4px;">点击刷新加载数据</div>
                        </div>

                        <!-- ⚠️ 失败几率最高 Top 3 -->
                        <div style="font-size: 11px; font-weight: bold; color: #f87171; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
                            <span>⚠️ 失败/空回复风险 Top 3</span>
                        </div>
                        <div id="pb_top_failed_list">
                            <div style="font-size: 11px; opacity: 0.6; text-align: center; padding: 4px;">点击刷新加载数据</div>
                        </div>

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

    // 3. 本地持久化
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

    // 4. API 余额查询
    $('#btn_check_api_balance').on('click', async function() {
        const btn = $(this);
        const resultBox = $('#api_balance_result');
        
        let apiUrl = $('#api_check_url').val().trim();
        const apiKey = realApiKey;

        if (!apiUrl) { toastr.warning('请填写接口地址！'); return; }
        if (!apiKey) { toastr.warning('请填写 API 密钥！'); return; }

        const originalBtnHtml = btn.html();
        btn.html('<i class="fa-solid fa-spinner fa-spin" style="margin-right: 6px;"></i> 查询中...');
        btn.css('pointer-events', 'none'); 
        resultBox.hide();

        apiUrl = apiUrl.replace(/\/+$/, '').replace(/\/v1$/, '');

        try {
            const subRes = await fetch(`${apiUrl}/v1/dashboard/billing/subscription`, { headers: { 'Authorization': `Bearer ${apiKey}` } });
            if (!subRes.ok) throw new Error(subRes.status === 401 ? "API Key 无效或已过期" : `请求失败 (${subRes.status})`);
            
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
                <div style="margin-bottom: 3px;"><span>总额度：</span> <b>$${totalAmount.toFixed(3)}</b></div>
                <div style="margin-bottom: 3px;"><span>已使用：</span> <b>$${usedAmount.toFixed(3)}</b></div>
                <hr style="border-color: rgba(255,255,255,0.1); margin: 4px 0;">
                <div><span>剩余可用：</span> <b style="color: #4ade80;">$${remaining.toFixed(3)}</b></div>
            `).fadeIn();
            toastr.success('余额查询成功！');

        } catch (error) {
            resultBox.html(`<div style="color: #f87171;"><b>查询失败：</b>${error.message}</div>`).fadeIn();
            toastr.error('查询失败，请检查设置');
        } finally {
            btn.html(originalBtnHtml);
            btn.css('pointer-events', 'auto');
        }
    });

    // 5. 模型健康分析（空回复风险也统一使用白字模型名）
    async function fetchWithFallback() {
        let lastErr = null;
        for (const url of CANDIDATE_URLS) {
            try {
                const res = await fetch(url);
                if (res.ok) {
                    const json = await res.json();
                    if (json && json.success) return json;
                }
            } catch (err) {
                lastErr = err;
            }
        }
        throw lastErr || new Error('节点响应异常');
    }

    async function loadPurpleBrainData() {
        const succContainer = $('#pb_top_success_list');
        const failContainer = $('#pb_top_failed_list');

        succContainer.html('<div style="font-size: 11px; opacity: 0.6;"><i class="fa-solid fa-spinner fa-spin"></i> 分析中...</div>');
        failContainer.html('<div style="font-size: 11px; opacity: 0.6;"><i class="fa-solid fa-spinner fa-spin"></i> 分析中...</div>');

        try {
            const json = await fetchWithFallback();

            const topSuccess = json.top_success_models || [];
            const topFailed = json.top_failed_models || [];

            // 1. 渲染成功几率最高 Top 3（白字模型名）
            if (!topSuccess.length) {
                succContainer.html('<div style="font-size: 11px; opacity: 0.5;">暂无成功记录</div>');
            } else {
                succContainer.html(topSuccess.map((m, idx) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.15); padding: 5px 8px; border-radius: 4px; margin-bottom: 4px; font-size: 11px;">
                        <span style="color: var(--SmartThemeBodyColor); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 65%; font-weight: 500;">${idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'} ${escapeHtml(m.model_name)}</span>
                        <span style="color: #4ade80; font-weight: bold;">成功率 ${m.success_rate}%</span>
                    </div>
                `).join(''));
            }

            // 2. 渲染失败几率最高 Top 3（模型名改用白字 var(--SmartThemeBodyColor)，只保留失败占比为红色）
            if (!topFailed.length) {
                failContainer.html('<div style="font-size: 11px; opacity: 0.5;">暂无失败风险记录</div>');
            } else {
                failContainer.html(topFailed.map(m => `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(248,113,113,0.08); padding: 5px 8px; border-radius: 4px; margin-bottom: 4px; font-size: 11px; border: 1px solid rgba(248,113,113,0.15);">
                        <span style="color: var(--SmartThemeBodyColor); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 65%; font-weight: 500;">⚠️ ${escapeHtml(m.model_name)}</span>
                        <span style="color: #f87171; font-weight: bold;">失败占比 ${m.fail_rate}%</span>
                    </div>
                `).join(''));
            }

        } catch (err) {
            succContainer.html(`<div style="color: #f87171; font-size: 11px;">拉取失败: ${escapeHtml(err.message)}</div>`);
            failContainer.empty();
        }
    }

    function escapeHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    $('#btn_refresh_purple_brain').on('click', function() {
        loadPurpleBrainData();
    });

    loadPurpleBrainData();
});
