import { supabase } from './auth.js';

async function getClientIp() {
    try {
        const response = await fetch('https://api64.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.error("IP Fetch Error:", error);
        return 'Unknown'; 
    }
}

export const AuditLogger = {
    async log(action, targetId, newData = {}, oldData = null) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Anonymous actions cannot be logged.");

            const ip = await getClientIp();

            const payload = {
                admin_id: user.id,
                action_type: action.toUpperCase(),
                target_id: targetId,
                new_value: newData,
                old_value: oldData,
                ip_address: ip,
                created_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('system_audit_logs')
                .insert([payload]);

            if (error) {
                console.error(`[AUDIT_FAIL]: ${action} for ${targetId} - ${error.message}`);
            } else {
                console.log(`[AUDIT_SUCCESS]: ${action} recorded.`);
            }
        } catch (err) {
            console.error("Critical Logger Failure:", err.message);
        }
    }
};

export const logAction = (action, targetId, newData, oldData) => {
    return AuditLogger.log(action, targetId, newData, oldData);
};
