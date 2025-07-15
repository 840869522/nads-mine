const Array2String = (data: string[] | null): string => {
    if (!data || data.length == 0) {
        return "";
    }
    return data.join(",");
}

const String2Array = (data: string | null): string[] => {
    var reqData = []
    if (!data || data.trim()) {
        reqData =  [];
    }
    reqData = data.split(",").filter(Boolean);
    return reqData;
}

export {
    Array2String,
    String2Array
}