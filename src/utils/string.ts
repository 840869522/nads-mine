const Array2String = (data: string[] | null): string => {
    if (!data || data.length == 0) {
        return "";
    }
    return data.join(",");
}

const Sttring2Array = (data: string | null): string[] => {
    if (!data || data.trim()) {
        return [];
    }
    return data.split(",").filter(Boolean);
}

export {
    Array2String,
    Sttring2Array
}