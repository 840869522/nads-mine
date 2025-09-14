import { PermissionFormData } from "@/components/admin/PermissionModal";
import { useAuth } from "@/hooks/useAuth";
import { AppPermission, NavItemType } from "@/types";
import { apiClient } from "@/utils/axios";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";

type Route_Permission = {
    prefix: string,
    key: string
}

type PerData = {
    label: string,
    key: string,
    children: PerData[] | null
}

interface PermissionAndMenuContextType {
    appAllPermission: AppPermission[] | [],
    userSiderMenu: NavItemType[] | [],
    id2nameMap: { string: string },
    routeAndPermission: Route_Permission[],
    updateData: (add: boolean, data?: PermissionFormData) => void
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
    const [id2nameMap, setId2NameMap] = useState<{ string: string } | {}>({});
    const [routeAndPermission, SetRouteAndPermission] = useState<Route_Permission[] | []>([]);

    const mapId2Name = (data, per: PerData[]) => {
        per.map(item => {
            data[item.key] = item.label;
            if (item.children) {
                mapId2Name(data, item.children)
            }
        })
    }


    const mapRouteAndPmerission = (data: Route_Permission[], per: NavItemType[]) => {
        per.map(item => {
            if (item.to?.trim()) {
                data.push({ prefix: item.to, key: item.requiredPermission || "" })
            }
            if (item.children) {
                mapRouteAndPmerission(data, item.children)
            }
        })

    }


    const getPermissionLabelAndMenuData = () => {
        if (user) {
            apiClient.post("/back/api/support/permission/all_menu").then((res) => {
                if (res.data.code === 200) {
                    setUserSiderMenu(res.data.data);
                    var routeApermission = []
                    mapRouteAndPmerission(routeApermission, res.data.data);
                    routeApermission = routeApermission.filter(Boolean);
                    SetRouteAndPermission(routeApermission);
                }
            })
            apiClient.post("/back/api/support/permission/all_permission").then((res) => {
                if (res.data.code === 200) {
                    setAppAllPermission(res.data.data);
                    var map = { '0': '顶级权限' }
                    mapId2Name(map, res.data.data);
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
            if (data?.is_menu) {
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
    return <PermissionAndMenuContext.Provider value={{ appAllPermission, userSiderMenu, id2nameMap, routeAndPermission, updateData }}>
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