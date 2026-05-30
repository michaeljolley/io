export interface Attachment {
	id: string;
	messageId?: string;
	filename: string;
	mimeType?: string;
	sizeBytes?: number;
	diskPath: string;
	createdAt: Date;
}
