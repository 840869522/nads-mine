import { useAuth } from "@/hooks/useAuth";
import { AppPermission, NavItemType } from "@/types";
import { apiClient } from "@/utils/axios";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";

interface PermissionAndMenuContextType {
    appAllPermission: AppPermission[] | [],
    userSiderMenu: NavItemType[] | []

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
    useEffect(() => {
        if (user) {
            apiClient.post("/back/api/support/permission/all_menu").then((res) => {
                if (res.data.code === 200)
                    setUserSiderMenu(res.data.data);
            })
            apiClient.post("/back/api/support/permission/all_permission").then((res) => {
                if (res.data.code === 200)
                    setAppAllPermission(res.data.data);
            })
        }
    }, [user]);
    return <PermissionAndMenuContext.Provider value={{ appAllPermission, userSiderMenu }}>
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