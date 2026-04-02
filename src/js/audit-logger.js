import { supabase } from '../auth.js';

export const AuditLogger = {
    /**
     * UNIVERSAL LOGGING ENGINE
     * @param {string} action - The type of action (e.g., 'DEPLOY_EVENT', 'COLLECT_FEE', 'VOID_RECEIPT')
     * @param {string} targetId - The UUID of the record being affected
     * @param {object} newData - The new state of the data (the 'After')
     * @param {object} oldData - The previous state of the data (the 'Before')
     */
    async log(action, targetId, newData = {}, oldData = null) {
        try {
            // 1. Identify who is performing the action
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Anonymous actions cannot be logged.");

            // 2. Prepare the Payload
            const payload = {
                admin_id: user.id,
                action_type: action.toUpperCase(),
                target_id: targetId,
                new_value: newData, // JSONB column
                old_value: oldData, // JSONB column
                created_at: new Date().toISOString()
            };

            // 3. Silent Execution (Don't let a log failure stop the main app)
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
