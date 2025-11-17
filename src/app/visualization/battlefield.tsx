import * as Cesium from "cesium";
import {useEffect, useLayoutEffect, useRef, useState} from "react";
import {Cartesian3, Color, Entity, HeadingPitchRoll, PolylineGlowMaterialProperty, Transforms, Viewer, Math as CesiumMath, CallbackProperty } from "cesium";
import Team, { BattlefieldInfo, LogInfo, TeamInfo } from "./team";
import { AdData } from "./page";
import axios from "axios";
import { it } from "node:test";

interface PlaneEntityOptions {
    viewer: Viewer;
    name?: string;
    position: [number, number, number];  // [lon, lat, height]
    orientationTarget?: [number, number, number]; // [lon, lat, height] 用于计算朝向
    heading?: number;  // 偏航角，度
    pitch?: number;    // 俯仰角，度
    roll?: number;     // 翻滚角，度
    modelUri?: string;
    size?: number;
}

function generateRandomPositionsWithHeight(
    center: [number, number], // [lon, lat]
    latRange: number,          // 纬度范围
    lonRange: number,          // 经度范围
    heightRange: [number, number] = [500, 1500], // 高度范围
    count: number = 3
): [number, number, number][] {
    const [centerLon, centerLat] = center;
    const positions: [number, number, number][] = [];

    for (let i = 0; i < count; i++) {
        const lon = centerLon + (Math.random() - 0.5) * 2 * lonRange;
        const lat = centerLat + (Math.random() - 0.5) * 2 * latRange;
        const height = heightRange[0] + Math.random() * (heightRange[1] - heightRange[0]);
        positions.push([lon, lat, height]);
    }

    return positions;
}


function addPlaneEntity(options: PlaneEntityOptions) {
    const {
        viewer,
        name = '飞机',
        position,
        orientationTarget,
        heading = 0,
        pitch = 0,
        roll = 0,
        modelUri = '/mapdata/model/Cesium_Air.glb',
        size = 100
    } = options;

     const hpr = new HeadingPitchRoll(
        CesiumMath.toRadians(heading),
        CesiumMath.toRadians(pitch),
        CesiumMath.toRadians(roll)
    );

    const pos = Cartesian3.fromDegrees(position[0], position[1], position[2]);

    const entity = viewer.entities.add({
        name,
        position: pos,
        orientation: Transforms.headingPitchRollQuaternion(pos, hpr),
        model: {
            uri: modelUri,
            minimumPixelSize: size,
            maximumScale: 10000,
            show: true,
        },
    });

    return entity;
}

// 加载地形的异步函数
async function addWorldTerrainAsync(viewer: Cesium.Viewer) {
    try {
        const terrainProvider = await Cesium.CesiumTerrainProvider.fromUrl('/mapdata/terrain/', {
            requestWaterMask: true,
            requestVertexNormals: true,
        });
        viewer.terrainProvider = terrainProvider;

        viewer.scene.globe.depthTestAgainstTerrain = true;

        console.log("地形加载成功");
    } catch (error) {
        // console.error(`地形加载失败: ${error}`);
        // alert('地形数据加载失败，请检查控制台日志');
    }
}

async function addWorldImageryAsync(viewer: Cesium.Viewer) {
    viewer.imageryLayers.removeAll();

    const tmsImageryProvider = new Cesium.UrlTemplateImageryProvider({
        url: '/mapdata/map4/laiwu/{z}/{x}/{y}.png',
        tilingScheme: new Cesium.WebMercatorTilingScheme(),
        minimumLevel: 0, 
        maximumLevel: 15,
    });

    viewer.scene.imageryLayers.addImageryProvider(tmsImageryProvider);
}

function shootLaser(viewer: Viewer, from: Cartesian3, to: Cartesian3, duration: number = 3000): Entity {
  const startTime = Date.now();

  // 用 CallbackProperty 动态返回 positions，保证每帧刷新
  const positions = new CallbackProperty(() => {
    const elapsed = Date.now() - startTime;
    if (elapsed >= duration) {
      // 超时移除实体
      if (viewer.entities.contains(laserEntity)) {
        viewer.entities.remove(laserEntity);
        viewer.scene.requestRender();
      }
      return undefined; // 返回 undefined 则不再渲染
    }
    return [from, to];
  }, false);

  const laserEntity = viewer.entities.add({
    name: "激光射线",
    polyline: {
      positions,
      width: 5.0,
      material: new PolylineGlowMaterialProperty({
        glowPower: 0.3,
        color: Color.RED.withAlpha(0.9),
      }),
      clampToGround: false,
    },
  });

  return laserEntity;
}

interface VMItem {
    name: string;
    ip: string;
    teamName: string;
}

interface VMResult {
    trueTargetList: VMItem[];
    falseTargetList: VMItem[];
}

interface FlagLog {
    redLogList: LogInfo[];
    blueLogList: LogInfo[];
}

interface Position{
    x: number;
    y: number;
    z: number;
}

// 定义方向枚举 (TypeScript Enum)
export enum MovementDirection {
    EAST = 'EAST',
    WEST = 'WEST',
    NORTH = 'NORTH',
    SOUTH = 'SOUTH',
    UP = 'UP',
    DOWN = 'DOWN',
}

function animateEntityCardinalMove(
    entity: Cesium.Entity,
    direction: MovementDirection,
    distanceInMeters: number,
    viewer: Cesium.Viewer
): Promise<boolean> {
    
    // 动画时长固定为 2.0 秒
    const durationSeconds: number = 1.5;
    const initialTime: Cesium.JulianDate = viewer.clock.currentTime;
    // 计算结束时间
    const finalTime: Cesium.JulianDate = Cesium.JulianDate.addSeconds(initialTime, durationSeconds, new Cesium.JulianDate());

    // 1. 获取当前笛卡尔坐标（起点）
    const startPosition: Cesium.Cartesian3 | undefined = entity.position?.getValue(initialTime);
    
    if (!startPosition) {
        return Promise.reject(new Error('实体无效或无法获取当前位置。'));
    }

    // 2. 根据起点、方向和距离计算终点

    // 获取 East-North-Up (ENU) 局部坐标系转换矩阵。
    const modelMatrix: Cesium.Matrix4 = Cesium.Transforms.eastNorthUpToFixedFrame(startPosition, Cesium.Ellipsoid.WGS84, new Cesium.Matrix4());
    
    // 从模型矩阵中提取局部方向向量 (Cartesian3)
    const eastVector4: Cesium.Cartesian4 = Cesium.Matrix4.getColumn(modelMatrix, 0, new Cesium.Cartesian4());
    const northVector4: Cesium.Cartesian4 = Cesium.Matrix4.getColumn(modelMatrix, 1, new Cesium.Cartesian4());
    const upVector4: Cesium.Cartesian4 = Cesium.Matrix4.getColumn(modelMatrix, 2, new Cesium.Cartesian4());

    const east: Cesium.Cartesian3 = Cesium.Cartesian3.fromCartesian4(eastVector4, new Cesium.Cartesian3());
    const north: Cesium.Cartesian3 = Cesium.Cartesian3.fromCartesian4(northVector4, new Cesium.Cartesian3());
    const up: Cesium.Cartesian3 = Cesium.Cartesian3.fromCartesian4(upVector4, new Cesium.Cartesian3());
    
    let directionVector: Cesium.Cartesian3 = new Cesium.Cartesian3();

    switch (direction) {
        case MovementDirection.EAST:
            directionVector = Cesium.Cartesian3.multiplyByScalar(east, distanceInMeters, directionVector);
            break;
        case MovementDirection.WEST: // 西 = -东
            directionVector = Cesium.Cartesian3.multiplyByScalar(east, -distanceInMeters, directionVector);
            break;
        case MovementDirection.NORTH:
            directionVector = Cesium.Cartesian3.multiplyByScalar(north, distanceInMeters, directionVector);
            break;
        case MovementDirection.SOUTH: // 南 = -北
            directionVector = Cesium.Cartesian3.multiplyByScalar(north, -distanceInMeters, directionVector);
            break;
        case MovementDirection.UP:
            directionVector = Cesium.Cartesian3.multiplyByScalar(up, distanceInMeters, directionVector);
            break;
        case MovementDirection.DOWN: // 下 = -上
            directionVector = Cesium.Cartesian3.multiplyByScalar(up, -distanceInMeters, directionVector);
            break;
        default:
            // TypeScript 的类型保护使我们知道这里不会被访问，但为了运行时安全仍然保留
            return Promise.reject(new Error(`无效的方向参数: ${direction}`));
    }
    
    // 计算终点位置 (起点 + 移动向量)
    const endPosition: Cesium.Cartesian3 = Cesium.Cartesian3.add(startPosition, directionVector, new Cesium.Cartesian3());

    // 3. 创建 SampledPositionProperty 并定义动画
    const positionProperty: Cesium.SampledPositionProperty = new Cesium.SampledPositionProperty();
    
    positionProperty.setInterpolationOptions({
        interpolationDegree: 1,
        interpolationAlgorithm: Cesium.LagrangePolynomialApproximation
    });

    // 添加起点和终点
    positionProperty.addSample(initialTime, startPosition);
    positionProperty.addSample(finalTime, endPosition);

    // 4. 赋值给实体并启动时钟
    entity.position = positionProperty;
    viewer.clock.shouldAnimate = true;
    
    // 5. 动画完成后的处理：用固定位置替换 SampledPositionProperty
    return new Promise((resolve: (value: boolean) => void) => {
        let finished: boolean = false;
        
        // 监听每一帧渲染
        const removeListener: Cesium.Event.RemoveCallback = viewer.scene.postRender.addEventListener(() => {
            if (Cesium.JulianDate.greaterThanOrEquals(viewer.clock.currentTime, finalTime) && !finished) {
                removeListener();
                finished = true;
                
                // 替换为 ConstantPositionProperty，固定模型在终点位置
                entity.position = new Cesium.ConstantPositionProperty(endPosition.clone());
                
                resolve(true);
            }
        });
    });
}

/**
 * 获取 VM 列表并拆分 trueList / falseList
 */
async function fetchVMs(instanceId: string): Promise<VMResult> {
    try {
        const res = await fetch(`/back/api/visualization/${instanceId}/vms`);
        if (!res.ok) throw new Error(`网络请求失败: ${res.status}`);

        const json = await res.json();
        // 直接返回 data 部分，前端拿到就是 { trueTargetList, falseTargetList }
        return json.data as VMResult;
    } catch (err) {
        console.error("请求接口出错:", err);
        // 异常时返回空列表，保证类型安全
        return { trueTargetList: [], falseTargetList: [] };
    }
}

async function fetchLogs(instanceId: string): Promise<LogInfo[]> {
    try {
        const res = await fetch(`/back/api/visualization/${instanceId}/logs`);
        if (!res.ok) throw new Error(`网络请求失败: ${res.status}`);

        const json = await res.json();
       
        return json.data as LogInfo[];
    } catch (err) {
        console.error("请求接口出错:", err);
        // 异常时返回空列表，保证类型安全
        return [];
    }
}

export default function Battlefield (adData: AdData) {
    const containerRef = useRef<HTMLDivElement>(null);
    const battlefieldRef = useRef<HTMLDivElement>(null);

    const blueTeam: BattlefieldInfo = {
        type: 0,
        sceneId: adData ? adData.id : "",
        logInfo: blueLogInfos
    }

    const redTeam: BattlefieldInfo = {
        type: 1,
        sceneId: adData ? adData.id : "",
        logInfo: redLogInfos
    }

    const [redTeamState, setRedTeamState] = useState<BattlefieldInfo>(redTeam);
    const [blueTeamState, setBlueTeamState] = useState<BattlefieldInfo>(blueTeam);
    const [vms, setVms] = useState<VMResult>({ trueTargetList: [], falseTargetList: [] });

    useEffect(() => {
        if (!containerRef.current) return;

        Cesium.Ion.defaultAccessToken = ''

        const viewer = new Cesium.Viewer(containerRef.current, {
            baseLayerPicker: false,
            geocoder: false,
            homeButton: false,         // 隐藏主视图控件
            animation: false,
            timeline: false,
            sceneModePicker: false,
            navigationHelpButton: false,
            fullscreenButton: true,
            baseLayer: false,
            requestRenderMode: true, // 静态场景只在需要时渲染
        });

        viewer.resize();

        const container = document.getElementById('cesiumContainer');
        const canvas = container!.querySelector('canvas');
        if (canvas) {
            canvas.width = container!.clientWidth;
            canvas.height = container!.clientHeight;
        }


        addWorldImageryAsync(viewer).catch(err => {
            console.error('加载影像图层失败:', err);
        });

        // viewer.resolutionScale = window.devicePixelRatio;
        // viewer.scene.globe.maximumScreenSpaceError = 1;

        // 调用加载地形函数
        addWorldTerrainAsync(viewer);

        viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(
                117.58,
                36.08,
                10000
            ),
            orientation: {
                heading: Cesium.Math.toRadians(0),
                pitch: Cesium.Math.toRadians(-45),
                roll: 0
            }
        });
 
        viewer.scene.postProcessStages.fxaa.enabled = true;

        const redPlanes: { ip: string; object: Cesium.Entity; pos: Cartesian3  }[] = [];
        const bluePlanes: { ip: string; object: Cesium.Entity; pos: Cartesian3 }[] = [];

        let lastData : Position | null  = null;
        let dataIp: string[] = [];
        const pollingCallback = () => {
            axios.get(`/api/drone?ip=${dataIp[0]}&ip=${dataIp[1]}`)
                .then(response => {
                    if(response.data.status === 200){
                        let data: Position = response.data.data;
                        if(lastData === null){
                            lastData = data;
                            return;
                        }
                            
                        if(data.x - lastData.x >= 1){
                            animateEntityCardinalMove(
                                entity, 
                                MovementDirection.EAST, 
                                (data.x - lastData.x) * 200, 
                                viewer
                            );
                            shootLaser(viewer, entity2.position!.getValue(viewer.clock.currentTime)!, entity1.position!.getValue(viewer.clock.currentTime)!, 1000);
                            shootLaser(viewer, entity1.position!.getValue(viewer.clock.currentTime)!, entity.position!.getValue(viewer.clock.currentTime)!, 1000);
                            let dx = data.x - lastData.x;
                            setRedTeamState(prev => ({
                                ...prev,
                                logInfo: [...prev.logInfo, {
                                    logId: Date.now(),
                                    logTime: new Date().toLocaleTimeString(),
                                    logContent: `无人机向东移动了${dx}m`
                                }]
                            }));
                                
                        }
                        else if(data.x - lastData.x <= -1){
                            animateEntityCardinalMove(
                                entity, 
                                MovementDirection.WEST, 
                                (lastData.x - data.x) * 200, 
                                viewer
                            )
                            shootLaser(viewer, entity2.position!.getValue(viewer.clock.currentTime)!, entity1.position!.getValue(viewer.clock.currentTime)!, 1000);
                            shootLaser(viewer, entity1.position!.getValue(viewer.clock.currentTime)!, entity.position!.getValue(viewer.clock.currentTime)!, 1000);
                            let dx = lastData.x - data.x;
                            setRedTeamState(prev => ({
                                ...prev,
                                logInfo: [...prev.logInfo, {
                                    logId: Date.now(),
                                    logTime: new Date().toLocaleTimeString(),
                                    logContent: `无人机向西移动了${dx}m`
                                }]
                            }));
                        }
                        if(data.y - lastData.y >= 1){
                            animateEntityCardinalMove(
                                entity, 
                                MovementDirection.NORTH, 
                                (data.y - lastData.y) * 200, 
                                viewer
                            )
                            shootLaser(viewer, entity2.position!.getValue(viewer.clock.currentTime)!, entity1.position!.getValue(viewer.clock.currentTime)!, 1000);
                            shootLaser(viewer, entity1.position!.getValue(viewer.clock.currentTime)!, entity.position!.getValue(viewer.clock.currentTime)!, 1000);
                            let dy = data.y - lastData.y;
                            setRedTeamState(prev => ({
                                ...prev,
                                logInfo: [...prev.logInfo, {
                                    logId: Date.now(),
                                    logTime: new Date().toLocaleTimeString(),
                                    logContent: `无人机向北移动了${dy}m`
                                }]
                            }));
                        }else if(data.y - lastData.y <= -1){
                            animateEntityCardinalMove(
                                entity, 
                                MovementDirection.SOUTH, 
                                (lastData.y - data.y) * 200, 
                                viewer
                            )
                            shootLaser(viewer, entity2.position!.getValue(viewer.clock.currentTime)!, entity1.position!.getValue(viewer.clock.currentTime)!, 1000);
                            shootLaser(viewer, entity1.position!.getValue(viewer.clock.currentTime)!, entity.position!.getValue(viewer.clock.currentTime)!, 1000);
                            let dy = lastData.y - data.y;
                            setRedTeamState(prev => ({
                                ...prev,
                                logInfo: [...prev.logInfo, {
                                    logId: Date.now(),
                                    logTime: new Date().toLocaleTimeString(),
                                    logContent: `无人机向南移动了${dy}m`
                                }]
                            }));
                        }
                        if(data.z - lastData.z <= -1){
                            animateEntityCardinalMove(
                                entity, 
                                MovementDirection.UP, 
                                (lastData.z - data.z) * 200, 
                                viewer
                            )
                            shootLaser(viewer, entity2.position!.getValue(viewer.clock.currentTime)!, entity1.position!.getValue(viewer.clock.currentTime)!, 1000);
                            shootLaser(viewer, entity1.position!.getValue(viewer.clock.currentTime)!, entity.position!.getValue(viewer.clock.currentTime)!, 1000);
                            let dz = lastData.z - data.z;
                            setRedTeamState(prev => ({
                                ...prev,
                                logInfo: [...prev.logInfo, {
                                    logId: Date.now(),
                                    logTime: new Date().toLocaleTimeString(),
                                    logContent: `无人机向下移动了${dz}m`
                                }]
                            }));
                        }else if(data.z - lastData.z >= 1){
                            animateEntityCardinalMove(
                                entity, 
                                MovementDirection.DOWN, 
                                (data.z - lastData.z) * 200, 
                                viewer
                            )
                            shootLaser(viewer, entity2.position!.getValue(viewer.clock.currentTime)!, entity1.position!.getValue(viewer.clock.currentTime)!, 1000);
                            shootLaser(viewer, entity1.position!.getValue(viewer.clock.currentTime)!, entity.position!.getValue(viewer.clock.currentTime)!, 1000);
                            let dz = data.z - lastData.z;
                            setRedTeamState(prev => ({
                                ...prev,
                                logInfo: [...prev.logInfo, {
                                    logId: Date.now(),
                                    logTime: new Date().toLocaleTimeString(),
                                    logContent: `无人机向上移动了${dz}m`
                                }]
                            }));
                        }
                        lastData = data;
                    }
                    console.log(`[Polling] 成功收到响应:`, response.data.data);
                })
                .catch((error: any) => {
                    console.log('[Polling] 请求失败:', error);
                })
        };      

        // 封装启动轮询的逻辑
        const startPolling = async (pollingInterval: number) => {
            // 持续轮询的循环
            while (true) {
                try {
                    await pollingCallback(); // 等待 pollingCallback 完全执行完毕
                } catch (error) {
                    console.error('[Polling Loop] 轮询回调执行失败:', error);
                    // 可以在此添加错误处理逻辑，例如短暂暂停或退出循环
                }
                
                // 使用 Promise/setTimeout 等待设定的间隔时间，然后再进入下一次循环
                await new Promise(resolve => setTimeout(resolve, pollingInterval));
            }
        }

        async function fetchData() {
            const result = await fetchVMs(adData.id);
            setVms(result);
            // 循环生成实体并存到 redPlans
            result.trueTargetList.forEach((item, index) => {
                const ipString = String(item.name || '').trim(); 
                if (ipString.includes("C-2")){
                    dataIp.push(item.ip); 
                }else if (ipString.includes("C-3")){
                    dataIp.push(item.ip); 
                }
                // const pos = randomPositions1[index];
                // const entity = addPlaneEntity({
                //     viewer,
                //     name: `redPlane${index + 1}`,
                //     position:  [pos[0], pos[1], pos[2]],
                //     heading: 0,
                //     pitch: 0,
                //     roll: 0
                // });

                // bluePlanes.push({
                //     ip: item.ip,  // 取对象中的 ip
                //     object: entity,
                //     pos: Cartesian3.fromDegrees(pos[0], pos[1], pos[2])
                // });
            });

            // 循环生成实体并存到 redPlans
            result.falseTargetList.forEach((item, index) => {
                const ipString = String(item.name || '').trim(); 
                if (ipString.includes("C-2")){
                    dataIp.push(item.ip); 
                }else if (ipString.includes("C-3")){
                    dataIp.push(item.ip); 
                }
            });
            startPolling(4000);
            
            // pollingCallback(); 
            // intervalId = setInterval(pollingCallback, 2000);
        }


        // 每 5 秒执行一次 fetchLogs
        let lastRedLogLength = 0;
        let lastBlueLogLength = 0;

        const fetchAndUpdateLogs = async () => {
            try {
                const logs = await fetchLogs(adData.id);

                if (logs.length !== 0 && logs.length !== lastBlueLogLength) {
                    setBlueTeamState(prev => ({
                        ...prev,
                        logInfo: logs
                    }));
                    lastBlueLogLength = logs.length;
                }

            } catch (err) {
                console.error('fetchLogs error:', err);
            }
        };

        // 页面加载立即请求一次
        fetchAndUpdateLogs();

        // 然后每隔 5 秒轮询
        setInterval(fetchAndUpdateLogs, 5000);

        // let timer: string = "";
        // const handleMessage = (data: any) => {
        //     try {
        //         const msg = typeof data === "string" ? JSON.parse(data) : data;
        //         if (msg.type === "flag-log" && msg.timer !== timer && msg.data.scene_instance_id === adData.id) {
        //             timer = msg.timer;
        //             const now = new Date();
        //             const hours = now.getHours().toString().padStart(2, '0');
        //             const minutes = now.getMinutes().toString().padStart(2, '0');
        //             const seconds = now.getSeconds().toString().padStart(2, '0');
                            
        //             let logMessage = msg.data.success? `${msg.data.username}提交${msg.data.instance_name}的flag正确`
        //                 : `${msg.data.username}提交${msg.data.instance_name}的flag错误`
        
        //             let newLog: LogInfo = {
        //                 logId: Date.now(),
        //                 logTime: `${hours}:${minutes}:${seconds}`,
        //                 logContent: logMessage
        //             };
        
        //             if(msg.data.success){
        //                 setRedTeamState(prev => ({
        //                     ...prev,
        //                     logInfo: [...prev.logInfo, newLog]
        //                 }));
        //             }else{
        //                 setBlueTeamState(prev => ({
        //                     ...prev,
        //                     logInfo: [...prev.logInfo, newLog]
        //                 }));
        //             }
        //         }
        //     } catch (e) {
        //         console.error("解析 WebSocket 数据失败:", e, data);
        //     }
        // };

        const center1: [number, number] = [117.55, 36.17];
        const latRange = 0.01;
        const lonRange = 0.01;
        const heightRange: [number, number] = [500, 1500];

        const center2: [number, number] = [117.60, 36.17];

        const randomPositions1 = generateRandomPositionsWithHeight(center1, latRange, lonRange, heightRange,1);
        const randomPositions2 = generateRandomPositionsWithHeight(center2, latRange, lonRange, heightRange,2);
        const pos = randomPositions1[0];
        const pos1 = randomPositions2[0];
        const pos2 = randomPositions2[1];
        const entity = addPlaneEntity({
            viewer,
            name: `redPlane1`,
            position:  [pos[0], pos[1], pos[2]],
            heading: 0,
            pitch: 0,
            roll: 0,
            modelUri: '/mapdata/model/CesiumDrone.glb',
            size: 80
        });

        const entity1 = addPlaneEntity({
            viewer,
            name: `redPlane2`,
            position:  [pos1[0], pos1[1], 200],
            heading: 0,
            pitch: 0,
            roll: 0,
            modelUri: '/mapdata/model/GroundVehicle.glb',
            size: 50
        });

        const entity2 = addPlaneEntity({
            viewer,
            name: `redPlane2`,
            position:  [pos2[0], pos2[1], 200],
            heading: 0,
            pitch: 0,
            roll: 0,
            modelUri: '/mapdata/model/GroundVehicle.glb',
            size: 50
        });

        let intervalId: any;
        
        if(adData && adData.id !== ""){
            fetchData();
            // websocketClient.onMessage(handleMessage);
        }
        
        let canceled = false;

        const shootLoop = () => {
            if (canceled) return;

            // 数组为空，短轮询
            if (redPlanes.length === 0 || bluePlanes.length === 0) {
                setTimeout(shootLoop, 500); // 0.5 秒重试
                return;
            }

            // 随机选择红蓝实体
            const red = redPlanes[Math.floor(Math.random() * redPlanes.length)];
            const blue = bluePlanes[Math.floor(Math.random() * bluePlanes.length)];

            // 获取当前位置
            const fromPos = red.pos;
            const toPos = blue.pos;

            if (fromPos && toPos) {
                // 强制渲染一次，保证第一次能显示
                viewer.scene.requestRender();
                shootLaser(viewer, fromPos, toPos, 3000); // 射线持续 3 秒
            } else {
                // 位置未准备好，短时间重试
                setTimeout(shootLoop, 100);
                return;
            }

            viewer.scene.requestRender();
            // 下一次随机间隔 5–10 秒
            const nextDelay = (5 + Math.random() * 5) * 1000;
            setTimeout(shootLoop, nextDelay);
        };

        // 启动第一次
        if(adData.showAttack === 1)
            shootLoop();
        
        return () => {
            canceled = true;
            viewer.destroy();
            clearInterval(intervalId);
            // websocketClient.offMessage(handleMessage);
        };
    }, [adData.id]);
    return (
        <div className="h-full col-start-2 row-start-2 bg-[rgba(0,10,20,0.8)] border border-[rgba(0,150,255,0.4)] rounded-lg relative shadow-[0_0_25px_rgba(0,100,255,0.3)]">
            <Team {...blueTeamState} />
            <Team {...redTeamState} />
            <div className="relative w-full"
                    style={{
                        height: 'calc(100% - 60px)',
                        backgroundImage: `
                            linear-gradient(rgba(0,40,80,0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(0,40,80,0.1) 1px, transparent 1px)`,
                        backgroundSize: '35px 35px',
                    }}
                    ref={battlefieldRef}>
                <div ref={containerRef} id={"cesiumContainer"} 
                        className="w-full min-w-[100px] min-h-[100px] m-0 p-0"
                        style={{ height: 'calc(100% - 20px)', bottom: '1px' }}>  
                </div>
            </div>
        </div>
    );
}

const blueTeamInfos: TeamInfo[] = [
    {
        teamId: '1',
        teamName: '蓝方席位1',
        teamScore: 295
    },
    {
        teamId: '2',
        teamName: '蓝方席位2',
        teamScore: 285
    },
    {
        teamId: '3',
        teamName: '蓝方席位3',
        teamScore: 270
    },
]

const blueLogInfos: LogInfo[] = [
    
]

const redTeamInfos: TeamInfo[] = [
    {
        teamId: '1',
        teamName: '红方席位1',
        teamScore: 320
    },
    {
        teamId: '2',
        teamName: '红方席位2',
        teamScore: 300
    },
    {
        teamId: '3',
        teamName: '红方席位3',
        teamScore: 285
    },
    {
        teamId: '4',
        teamName: '红方席位4',
        teamScore: 270
    },
]

const redLogInfos: LogInfo[] = [
    
]