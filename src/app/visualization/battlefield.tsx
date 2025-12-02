import * as Cesium from "cesium";
import {useEffect, useLayoutEffect, useRef, useState} from "react";
import {Cartesian3, Color, Entity, HeadingPitchRoll, PolylineGlowMaterialProperty, Transforms, Viewer, Math as CesiumMath, CallbackProperty, JulianDate, PositionProperty } from "cesium";
import Team, { BattlefieldInfo, LogInfo, TeamInfo } from "./team";
import { AdData } from "./page";
import axios from "axios";
import { it } from "node:test";
import { is } from "zod/v4/locales";

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

function trackLineBetweenEntities(
    viewer: Cesium.Viewer, 
    fromEntity: Cesium.Entity, 
    toEntity: Cesium.Entity, 
    duration: number = 3000
): Cesium.Entity {
    
    // 使用 Date.now() 计时移除
    const startTime = Date.now();
    const endTime = startTime + duration;
    
    let lineEntity: Cesium.Entity | null = null; 

    // 使用 CallbackProperty 动态获取位置
    const positions = new Cesium.CallbackProperty((time: any, result: Cesium.Cartesian3[] = []) => { 
        
        // 1. 检查计时
        if (Date.now() >= endTime) {
            if (lineEntity && viewer.entities.contains(lineEntity)) {
                viewer.entities.remove(lineEntity);
                viewer.scene.requestRender();
            }
            return undefined; 
        }
        
        // 2. 获取当前 Cesium 渲染时间
        const currentTime = viewer.clock.currentTime;
        
        // 3. 关键点：每帧都从实体实例上读取最新的 position 属性
        const fromPosition = fromEntity.position;
        const toPosition = toEntity.position;

        // 4. 从最新的 position 属性中获取值
        if (fromPosition && toPosition) {
            const from = fromPosition.getValue(currentTime, new Cesium.Cartesian3());
            const to = toPosition.getValue(currentTime, new Cesium.Cartesian3());
            
            if (from && to) {
                result[0] = from;
                result[1] = to;
                return result;
            }
        }
        
        return undefined;
        
    }, false); // isConstant: false 保持动态更新

    // 5. 创建实体
    lineEntity = viewer.entities.add({
        name: "动态跟踪直线",
        polyline: {
            positions,
            width: 5.0,
            material: new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.3,
                color: Cesium.Color.RED.withAlpha(0.9),
            }),
            clampToGround: false,
        },
    });

    return lineEntity;
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

interface CompoundMove {
    east: number;  // 向东的距离（米）。负数表示向西。
    north: number; // 向北的距离（米）。负数表示向南。
    up: number;    // 向上的距离（米）。负数表示向下。
}

/**
 * 在 3 秒内将 Cesium 实体平滑移动一个由三个轴向分量定义的斜向距离。
 *
 * @param entity 要移动的实体。
 * @param moveVector 包含 East, North, Up 轴上总位移的对象。
 * @param viewer Cesium Viewer 实例。
 * @returns Promise<boolean> 动画完成时解析。
 */
function animateEntityCompoundMove(
    entity: Cesium.Entity,
    moveVector: CompoundMove,
    viewer: Cesium.Viewer
): Promise<boolean> {
    
    // 动画时长固定为 3.0 秒
    const durationSeconds: number = 2.0;
    const initialTime: Cesium.JulianDate = viewer.clock.currentTime;
    const finalTime: Cesium.JulianDate = Cesium.JulianDate.addSeconds(initialTime, durationSeconds, new Cesium.JulianDate());

    const startPosition: Cesium.Cartesian3 | undefined = entity.position?.getValue(initialTime);
    
    if (!startPosition) {
        return Promise.reject(new Error('实体无效或无法获取当前位置。'));
    }

    // 1. 获取 East-North-Up 局部坐标系向量
    const modelMatrix: Cesium.Matrix4 = Cesium.Transforms.eastNorthUpToFixedFrame(startPosition, Cesium.Ellipsoid.WGS84, new Cesium.Matrix4());
    
    // 提取单位向量
    const east: Cesium.Cartesian3 = Cesium.Cartesian3.fromCartesian4(Cesium.Matrix4.getColumn(modelMatrix, 0, new Cesium.Cartesian4()), new Cesium.Cartesian3());
    const north: Cesium.Cartesian3 = Cesium.Cartesian3.fromCartesian4(Cesium.Matrix4.getColumn(modelMatrix, 1, new Cesium.Cartesian4()), new Cesium.Cartesian3());
    const up: Cesium.Cartesian3 = Cesium.Cartesian3.fromCartesian4(Cesium.Matrix4.getColumn(modelMatrix, 2, new Cesium.Cartesian4()), new Cesium.Cartesian3());
    
    // 2. 计算合成的移动向量 (Scaled Vector Sum)
    
    // East/West 分量
    const eastOffset: Cesium.Cartesian3 = Cesium.Cartesian3.multiplyByScalar(east, moveVector.east, new Cesium.Cartesian3());
    
    // North/South 分量
    const northOffset: Cesium.Cartesian3 = Cesium.Cartesian3.multiplyByScalar(north, moveVector.north, new Cesium.Cartesian3());
    
    // Up/Down 分量
    const upOffset: Cesium.Cartesian3 = Cesium.Cartesian3.multiplyByScalar(up, moveVector.up, new Cesium.Cartesian3());
    
    // 将三个分量向量相加，得到最终的位移向量
    let totalOffsetVector: Cesium.Cartesian3 = Cesium.Cartesian3.add(eastOffset, northOffset, new Cesium.Cartesian3());
    totalOffsetVector = Cesium.Cartesian3.add(totalOffsetVector, upOffset, totalOffsetVector);

    // 3. 计算终点位置
    const endPosition: Cesium.Cartesian3 = Cesium.Cartesian3.add(startPosition, totalOffsetVector, new Cesium.Cartesian3());

    // 4. 定义 SampledPositionProperty 动画 (与之前一致)
    const positionProperty: Cesium.SampledPositionProperty = new Cesium.SampledPositionProperty();
    positionProperty.setInterpolationOptions({
        interpolationDegree: 1,
        interpolationAlgorithm: Cesium.LagrangePolynomialApproximation
    });

    positionProperty.addSample(initialTime, startPosition);
    positionProperty.addSample(finalTime, endPosition);

    entity.position = positionProperty;
    viewer.clock.shouldAnimate = true;
    
    // 5. 动画完成后的 Promise 处理 (与之前一致)
    return new Promise((resolve: (value: boolean) => void) => {
        let finished: boolean = false;
        
        const removeListener: Cesium.Event.RemoveCallback = viewer.scene.postRender.addEventListener(() => {
            if (Cesium.JulianDate.greaterThanOrEquals(viewer.clock.currentTime, finalTime) && !finished) {
                removeListener();
                finished = true;
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
    const isFirst = useRef<boolean>(true);

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

        let lastData : Position = { x: 0, y: 0, z: 0 };
        let dataIp: string[] = [];
        let isFirstFetch = true;
        let id : number = 0;
        const pollingCallback = () => {
            axios.get(`/api/drone?ip=${dataIp[0]}&ip=${dataIp[1]}`)
                .then(response => {
                    const newLogs:LogInfo[] = [];
                    let isMove = false;

                    if(response.data.status === 200){
                        let data: Position = response.data.data;
                        if(isFirstFetch){
                            lastData = data;
                            isFirstFetch = false;
                            return;
                        }
                        
                        let dx = data.x - lastData.x;
                        let dy = data.y - lastData.y;
                        let dz = data.z - lastData.z;
                        if (dx !== 0) {
                            const direction = dx > 0 ? '东' : '西';
                            newLogs.push({
                                logId: id,
                                logTime: new Date().toLocaleTimeString(),
                                logContent: `无人机向${direction}移动了${Math.abs(dx)}m`,
                                name: "无人机",
                                userName: "无人机",
                                correct: 1
                            });
                            isMove = true;
                        }
                        if (dy !== 0) {
                            const direction = dy > 0 ? '北' : '南';
                            newLogs.push({
                                logId: id+1,
                                logTime: new Date().toLocaleTimeString(),
                                logContent: `无人机向${direction}移动了${Math.abs(dy)}m`,
                                name: "无人机",
                                userName: "无人机",
                                correct: 1
                            });
                            isMove = true;
                        }
                        if (dz !== 0) {
                            const direction = dz > 0 ? '上' : '下';
                            newLogs.push({
                                logId: id+2,
                                logTime: new Date().toLocaleTimeString(),
                                logContent: `无人机向${direction}移动了${Math.abs(dz)}m`,
                                name: "无人机",
                                userName: "无人机",
                                correct: 1
                            });
                            isMove = true;
                        }
                        lastData = data;
                        id += 3;
                        if(isMove){
                            shootLaser(viewer, entity2.position!.getValue(viewer.clock.currentTime)!, entity1.position!.getValue(viewer.clock.currentTime)!, 800);
                            // shootLaser(viewer, entity1.position!.getValue(viewer.clock.currentTime)!, entity.position!.getValue(viewer.clock.currentTime)!, 800);
                            setRedTeamState(prev => {
                                // 定义用于创建复合键的函数
                                const getCompositeKey = (log: any): string => {
                                    // 使用 | 作为分隔符，确保 logTime 和 logContent 的组合是唯一的
                                    return `${log.logTime}|${log.logContent}`;
                                };
                                // 1. 构建一个包含所有现有日志复合键的 Set 集合
                                const existingKeys = new Set(prev.logInfo.map(getCompositeKey));

                                // 2. 过滤 newLogs，只保留复合键在现有集合中不存在的新日志
                                const uniqueNewLogs = newLogs.filter(newLog => 
                                    !existingKeys.has(getCompositeKey(newLog))
                                );
                                if (uniqueNewLogs.length > 0) {
                                    // 如果有，则返回新状态
                                    return {
                                        ...prev,
                                        logInfo: [
                                            ...prev.logInfo, 
                                            ...uniqueNewLogs // 只添加唯一的新日志
                                        ]
                                    };
                                }
                                return prev;
                            });

                            trackLineBetweenEntities(
                                viewer, 
                                entity1, // PositionProperty
                                entity, // PositionProperty
                                3000 // 直线将持续 3 秒
                            );
                            const diagonalMove = {
                                east: Math.abs(dx*40) > 1000 ? 1000 * Math.sign(dx) : dx*40,   
                                north: Math.abs(dy*40) > 1000 ? 1000 * Math.sign(dy) : dy*40,
                                up: dz * 20 < -200 ? -200 : dz * 20 
                            };

                            animateEntityCompoundMove(
                                entity, 
                                diagonalMove, 
                                viewer
                            )
                        }
                    }else if(response.data.status !== 200 && !isFirstFetch){
                        isFirstFetch = true;
                        lastData = { x: 0, y: 0, z: 0 };
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
            startPolling(2000);
            // pollingCallback(); 
            // intervalId = setInterval(pollingCallback, 3000);
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
        const heightRange: [number, number] = [1200, 1500];

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