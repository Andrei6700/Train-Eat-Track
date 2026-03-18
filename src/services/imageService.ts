import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "@/constants/config";
import { ResponseType } from '@/src/types/index';
import axios from "axios";

const CLOUDINARY_API_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

export const uploadFileToCloudinary = async (
    file: { uri?: string } | string,
    folderName: string
): Promise<ResponseType> => {
    try {
        // Validate folder name to prevent path traversal
        if (!folderName || typeof folderName !== 'string') {
            return { success: false, msg: "Invalid folder name" };
        }

        // Sanitize folder name
        const sanitizedFolder = folderName.replace(/[^a-zA-Z0-9_-]/g, '');

        if (typeof file === "string") {
            return { success: true, data: file }
        }

        if (file && file.uri) {
            const formData = new FormData();
            formData.append("file", {
                uri: file?.uri,
                type: "image/jpeg",
                name: file?.uri?.split("/").pop() || "file.jpg"
            } as any);

            formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
            formData.append("folder", sanitizedFolder);

            const response = await axios.post(CLOUDINARY_API_URL, formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
            timeout: 30000, // 30 second timeout
        });

            return { success: true, data: response?.data?.secure_url };
        }
        return { success: true };
    } catch (error: any) {
        console.error("[ImageService] Error uploading file:", error.code || "upload_failed");

        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            return { success: false, msg: "Upload timeout. Please try again." };
        }

        if (error.response?.status === 413) {
            return { success: false, msg: "Image is too large. Please use a smaller image." };
        }

        return { success: false, msg: "Could not upload image. Please try again." };
    }
};

export const getProfileImage = (file: any) => {
    if (file && typeof file === "string") return file;
    if (file && typeof file === "object") return file.uri;

    return require('@/assets/images/defaultAvatar.png');
};
