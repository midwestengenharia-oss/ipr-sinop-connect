import { Area } from "react-easy-crop";

export const getCroppedImg = (imageSrc: string, crop: Area): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.src = imageSrc;
        image.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            if (!ctx) return reject("Canvas context not found");

            const scaleX = image.naturalWidth / image.width;
            const scaleY = image.naturalHeight / image.height;

            canvas.width = crop.width;
            canvas.height = crop.height;

            ctx.drawImage(
                image,
                crop.x * scaleX,
                crop.y * scaleY,
                crop.width * scaleX,
                crop.height * scaleY,
                0,
                0,
                crop.width,
                crop.height
            );

            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject("Erro ao criar imagem cortada");
            }, "image/jpeg");
        };
        image.onerror = reject;
    });
};
