import {  PermissionFormData } from "@/components/admin/PermissionModal";
import { useAuth } from "@/hooks/useAuth";
import { AppPermission, NavItemType } from "@/types";
import { apiClient } from "@/utils/axios";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";

interface PermissionAndMenuContextType {
    appAllPermission: AppPermission[] | [],
    userSiderMenu: NavItemType[] | [],
    id2nameMap ,
    updateData: (add: boolean, data?: PermissionFormData) => void
}

type PerData = {
    label: string,
    key: string,
    children : PerData[] | null
}

const PermissionAndMenuContext = createContext<PermissionAndMenuContextType | undefined>(undefined);

interface PermissionAndMenuContextProviderProps {
    children: ReactNode
}

const PermissionAndMenuContextProvider: React.FC<PermissionAndMenuContextProviderProps> = ({
    children
}) => {
    const { user } = useAuth();
    const [appAllPermission, setAppAllPermission] = useState<AppPermission[] | []>([]);
    const [userSiderMenu, setUserSiderMenu] = useState<NavItemType[] | []>([]);
    const [id2nameMap, setId2NameMap] = useState<{string: string} | {}>({});

    const mapId2Name = (data, per:PerData[])=>{
        per.map(item => {
            data[item.key] = item.label;
            if (item.children) {
                mapId2Name(data,item.children)
            }
        })
    }


    const getPermissionLabelAndMenuData = () => {
        if (user) {
            apiClient.post("/back/api/support/permission/all_menu").then((res) => {
                if (res.data.code === 200)
                    setUserSiderMenu(res.data.data);
            })
            apiClient.post("/back/api/support/permission/all_permission").then((res) => {
                if (res.data.code === 200){
                    setAppAllPermission(res.data.data);
                    var map = {'0': '顶级权限'}
                    mapId2Name(map,res.data.data);
                    setId2NameMap(map);
                }
            })
        }
    }

    const updateData = (add: boolean, data?: PermissionFormData) => {
        if (add)
            getPermissionLabelAndMenuData();
        else {
            const newPerm = appAllPermission.map(item => item.key == data?.id ? {
                 ...item, 
                 key: data?.id, 
                 label: data?.label 
            } : item).filter(Boolean);
            setAppAllPermission(newPerm);
            if (data?.is_menu){
                apiClient.post("/back/api/support/permission/all_menu").then((res) => {
                    if (res.data.code === 200)
                        setUserSiderMenu(res.data.data);
                })
            }
        }
    }

    useEffect(() => {
        getPermissionLabelAndMenuData();
    }, [user]);
    return <PermissionAndMenuContext.Provider value={{ appAllPermission, userSiderMenu, id2nameMap,updateData }}>
        {children}
    </PermissionAndMenuContext.Provider>
};


const userPermissionContext = () => {
    const context = useContext(PermissionAndMenuContext);
    if (context === undefined)
        throw new Error('usePermissionContext must be used within an PermissionAndMenuContextProvider');
    return context;
}

export {
    userPermissionContext,
    PermissionAndMenuContextProvider,
    PermissionAndMenuContext
}