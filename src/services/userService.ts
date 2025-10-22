import { firestore } from "@/src/config/firebase";
import { ResponseType, UserDataType } from '@/src/types/index';
import { doc, updateDoc } from "firebase/firestore";
import { uploadFileToCloudinary } from "./imageService";

export const updateUser = async (
    uid: string,
    updatedData: UserDataType
): Promise<ResponseType> => {
    try {
        if (updatedData.image && updatedData?.image?.uri) {
            // upload image to cloudinary
            const imageUplaodRes = await uploadFileToCloudinary(updatedData.image, "users");
            if (!imageUplaodRes.success) {
                return { success: false, msg: imageUplaodRes.msg || "Could not upload image" };
            }
            updatedData.image = imageUplaodRes.data;
        }
        const userRef = doc(firestore, "users", uid);
        await updateDoc(userRef, updatedData);

        return { success: true, msg: "User updated successfully." };
    } catch (error: any) {
        console.log("Error updating user:", error);
        return { success: false, msg: error?.message };
    }
};
