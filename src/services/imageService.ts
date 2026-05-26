import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "@/constants/config";
import { ResponseType } from '@/src/types/index';
import axios from "axios";

const CLOUDINARY_API_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

export const uploadFileToCloudinary = async (
    file: { uri?: string } | string,
    folderName: string
): Promise<ResponseType> => {
    try {
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
            formData.append("folder", folderName);

            const response = await fetch(CLOUDINARY_API_URL, {
                method: "POST",
                body: formData,
            });
            const data = await response.json();

            if (response.ok && data?.secure_url) {
                return { success: true, data: data.secure_url };
            } else {
                return { success: false, msg: data?.error?.message || "Could not upload image." };
            }
        }
        return { success: true };
    } catch (error: any) {
        if (__DEV__) {
            console.log("Error uploading file to Cloudinary:", error);
        }
        return { success: false, msg: error?.message || "Could not upload image." };
    }
};

export const getProfileImage = (file: any) => {
    if (file && typeof file === "string") return file;
    if (file && typeof file === "object") return file.uri;

    return require('@/assets/images/defaultAvatar.png');
};