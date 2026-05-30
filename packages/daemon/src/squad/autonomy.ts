import type { AutonomyConfig } from '@io/shared';
import { createChildLogger } from '../logging/logger.js';

const logger = () => createChildLogger('autonomy');

export type PermissionAction = 'merge' | 'release' | 'close' | 'review';

export interface PermissionCheck {
	allowed: boolean;
	requiresApproval: boolean;
	reason?: string;
}

/**
 * Check if a squad has permission to perform an action based on its autonomy tier.
 */
export function checkPermission(config: AutonomyConfig, action: PermissionAction): PermissionCheck {
	switch (action) {
		case 'merge':
			if (config.canMergePrs) return { allowed: true, requiresApproval: false };
			if (config.requiresUserApprovalFor.includes('merge'))
				return {
					allowed: false,
					requiresApproval: true,
					reason: 'User approval required for merging PRs',
				};
			return { allowed: false, requiresApproval: false, reason: 'Merging PRs not allowed' };

		case 'release':
			if (config.canCreateReleases) return { allowed: true, requiresApproval: false };
			if (config.requiresUserApprovalFor.includes('release'))
				return {
					allowed: false,
					requiresApproval: true,
					reason: 'User approval required for releases',
				};
			return { allowed: false, requiresApproval: false, reason: 'Creating releases not allowed' };

		case 'close':
			if (config.canCloseIssues) return { allowed: true, requiresApproval: false };
			if (config.requiresUserApprovalFor.includes('close'))
				return {
					allowed: false,
					requiresApproval: true,
					reason: 'User approval required for closing issues',
				};
			return { allowed: false, requiresApproval: false, reason: 'Closing issues not allowed' };

		case 'review':
			if (config.canSelfReview) return { allowed: true, requiresApproval: false };
			if (config.requiresUserApprovalFor.includes('review'))
				return {
					allowed: false,
					requiresApproval: true,
					reason: 'User approval required for self-review',
				};
			return { allowed: false, requiresApproval: false, reason: 'Self-review not allowed' };

		default:
			return { allowed: false, requiresApproval: false, reason: `Unknown action: ${action}` };
	}
}

/**
 * Enforce a permission — logs and throws if not allowed.
 */
export function enforcePermission(
	config: AutonomyConfig,
	action: PermissionAction,
	squadName: string,
): void {
	const check = checkPermission(config, action);
	if (!check.allowed && !check.requiresApproval) {
		const msg = `Squad '${squadName}' is not permitted to ${action}: ${check.reason}`;
		logger().warn({ squadName, action }, msg);
		throw new Error(msg);
	}
}
