export function getDisplayDimensions(imageWidth, imageHeight, maxSize = 512, minSize = 50) {
    const safeW = Math.max(1, Number(imageWidth) || maxSize);
    const safeH = Math.max(1, Number(imageHeight) || maxSize);
    const aspect = safeW / safeH;

    if (safeW >= safeH) {
        const w = maxSize;
        return {
            imageWidth: safeW,
            imageHeight: safeH,
            aspect,
            w,
            h: Math.max(minSize, w / aspect)
        };
    }

    const h = maxSize;
    return {
        imageWidth: safeW,
        imageHeight: safeH,
        aspect,
        h,
        w: Math.max(minSize, h * aspect)
    };
}

export function createImageItem({
    x,
    y,
    imageRef,
    label = "Image",
    imageWidth,
    imageHeight,
    generateId,
    maxSize = 512,
    minSize = 50,
    extra = {}
}) {
    const dims = getDisplayDimensions(imageWidth, imageHeight, maxSize, minSize);

    return {
        id: generateId(),
        type: "image",
        x,
        y,
        w: dims.w,
        h: dims.h,
        image_ref: imageRef,
        label,
        image_width: dims.imageWidth,
        image_height: dims.imageHeight,
        aspect: dims.aspect,
        ...extra,
    };
}
