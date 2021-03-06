"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const moment = require("moment");
const withTimeout = require("promise-with-timeout");
const pull_behavior_1 = require("pull-behavior");
const rxjs_1 = require("rxjs");
const config_1 = require("../config");
const broadlinkHandler_1 = require("./broadlink/broadlinkHandler");
const iftttHandler_1 = require("./ifttt/iftttHandler");
const miioHandler_1 = require("./miio/miioHandler");
const mockHandler_1 = require("./mock/mockHandler");
const mqttHandler_1 = require("./mqtt/mqttHandler");
const orviboHandler_1 = require("./orvibo/orviboHandler");
const tasmotaHandler_1 = require("./tasmota/tasmotaHandler");
const tuyaHandler_1 = require("./tuya/tuyaHandler");
const yeelightHandler_1 = require("./yeelight/yeelightHandler");
class ModulesManager {
    constructor() {
        /**
         * Let subscribe to any status minion changed. from any brand module.
         */
        this.minionStatusChangedEvent = new rxjs_1.BehaviorSubject(undefined);
        /**
         * Allows to retrieve minions array. (used as proxy for all moduls).
         */
        this.retrieveMinions = new pull_behavior_1.PullBehavior();
        this.COMMUNICATE_DEVICE_TIMEOUT = moment.duration(15, 'seconds');
        /**
         * All modules handlers
         */
        this.modulesHandlers = [];
        /** Currently, do not coverage modules, only 'mock' for other tests. */
        if (config_1.Configuration.runningMode === 'test') {
            this.initHandler(new mockHandler_1.MockHandler());
            return;
        }
        this.initHandlers();
    }
    /**
     * Get all devices kinds of all brands.
     */
    get devicesKind() {
        const modulesDevices = [];
        for (const moduleHandler of this.modulesHandlers) {
            modulesDevices.push(...moduleHandler.devices);
        }
        return modulesDevices;
    }
    /**
     * Get current status of minion. (such as minion status on off etc.)
     */
    async getStatus(miniom) {
        const minionModule = this.getMinionModule(miniom.device.brand);
        if (!minionModule) {
            const errorResponse = {
                responseCode: 7404,
                message: `there is not module for -${miniom.device.brand}- brand`,
            };
            throw errorResponse;
        }
        try {
            return await withTimeout(minionModule.getStatus(miniom), this.COMMUNICATE_DEVICE_TIMEOUT.asMilliseconds());
        }
        catch (error) {
            if (typeof error.message === 'string' && error.message.indexOf('Promise not resolved after') !== -1) {
                throw {
                    responseCode: 1503,
                    message: 'communication with device fail, timeout',
                };
            }
            throw error;
        }
    }
    /**
     * Set minion new status. (such as turn minion on off etc.)
     * @param miniom minion to set status for.
     * @param setStatus the new status to set.
     */
    async setStatus(miniom, setStatus) {
        const minionModule = this.getMinionModule(miniom.device.brand);
        if (!minionModule) {
            const errorResponse = {
                responseCode: 7404,
                message: `there is not module for -${miniom.device.brand}- brand`,
            };
            throw errorResponse;
        }
        try {
            return await withTimeout(minionModule.setStatus(miniom, setStatus), this.COMMUNICATE_DEVICE_TIMEOUT.asMilliseconds());
        }
        catch (error) {
            if (typeof error.message === 'string' && error.message.indexOf('Promise not resolved after') !== -1) {
                throw {
                    responseCode: 1503,
                    message: 'communication with device fail, timeout',
                };
            }
            throw error;
        }
    }
    /**
     * Record data for currrent minion status.
     * Note, only few devices models support this feature.
     * For example it is used when need to record IR data to math status for next use.
     * @param minion minion to record for.
     * @param statusToRecordFor the specific status to record for.
     */
    async enterRecordMode(minion, statusToRecordFor) {
        const minionModule = this.getMinionModule(minion.device.brand);
        if (!minionModule) {
            const errorResponse = {
                responseCode: 7404,
                message: `there is not module for -${minion.device.brand}- brand`,
            };
            throw errorResponse;
        }
        /** Make sure that minion supprt recording */
        const modelKind = this.getModelKind(minionModule, minion.device);
        if (!modelKind || !modelKind.isRecordingSupported) {
            const errorResponse = {
                responseCode: 6409,
                message: `the minioin not support command recording or sending`,
            };
            throw errorResponse;
        }
        try {
            return await withTimeout(minionModule.enterRecordMode(minion, statusToRecordFor), this.COMMUNICATE_DEVICE_TIMEOUT.asMilliseconds());
        }
        catch (error) {
            if (typeof error.message === 'string' && error.message.indexOf('Promise not resolved after') !== -1) {
                throw {
                    responseCode: 1503,
                    message: 'communication with device fail, timeout',
                };
            }
            throw error;
        }
    }
    /**
     * Generate an RF or IR command for given status.
     * Note, only a few devices models support this feature.
     * For example, it is used to generate RF command to the RF wall switch, instead of buying remote and record the commands.
     * @param minion minion to generate for.
     * @param statusToGenerateFor the specific status to record for.
     */
    async generateCommand(minion, statusToGenerateFor) {
        const minionModule = this.getMinionModule(minion.device.brand);
        if (!minionModule) {
            const errorResponse = {
                responseCode: 7404,
                message: `there is not module for -${minion.device.brand}- brand`,
            };
            throw errorResponse;
        }
        /** Make sure that minion supprt recording */
        const modelKind = this.getModelKind(minionModule, minion.device);
        if (!modelKind || !modelKind.isRecordingSupported) {
            const errorResponse = {
                responseCode: 6409,
                message: `the minioin not support command recording or sending`,
            };
            throw errorResponse;
        }
        try {
            return await withTimeout(minionModule.generateCommand(minion, statusToGenerateFor), this.COMMUNICATE_DEVICE_TIMEOUT.asMilliseconds());
        }
        catch (error) {
            if (typeof error.message === 'string' && error.message.indexOf('Promise not resolved after') !== -1) {
                throw {
                    responseCode: 1503,
                    message: 'communication with device fail, timeout',
                };
            }
            throw error;
        }
    }
    /**
     * Update the currect module with fatched commands set.
     * see https://github.com/casanet/rf-commands-repo project API.
     * @param minion minioin to update commands by fetched commands set.
     * @param commandsSet Fetched RF commands set.
     */
    async setFetchedCommands(minion, commandsSet) {
        const minionModule = this.getMinionModule(minion.device.brand);
        if (!minionModule) {
            const errorResponse = {
                responseCode: 7404,
                message: `there is not module for -${minion.device.brand}- brand`,
            };
            throw errorResponse;
        }
        /** Make sure that minion supprt recording */
        const modelKind = this.getModelKind(minionModule, minion.device);
        if (!modelKind || !modelKind.isRecordingSupported) {
            const errorResponse = {
                responseCode: 6409,
                message: `the minioin not support command recording or sending`,
            };
            throw errorResponse;
        }
        try {
            return await withTimeout(minionModule.setFetchedCommands(minion, commandsSet), this.COMMUNICATE_DEVICE_TIMEOUT.asMilliseconds());
        }
        catch (error) {
            if (typeof error.message === 'string' && error.message.indexOf('Promise not resolved after') !== -1) {
                throw {
                    responseCode: 1503,
                    message: 'communication with device fail, timeout',
                };
            }
            throw error;
        }
    }
    /**
     * Refresh and reset all module communications.
     * Used for cleaning up communication before re-reading data, after communication auth changed or just hard reset module etc.
     */
    async refreshModules() {
        for (const brandHandler of this.modulesHandlers) {
            try {
                await withTimeout(brandHandler.refreshCommunication(), this.COMMUNICATE_DEVICE_TIMEOUT.asMilliseconds());
            }
            catch (error) { }
        }
    }
    /**
     * Reset module communication.
     * @param brand Brand module to reset.
     */
    async refreshModule(brand) {
        const minionModule = this.getMinionModule(brand);
        if (!minionModule) {
            const errorResponse = {
                responseCode: 7404,
                message: `there is not module for -${brand}- brand`,
            };
            throw errorResponse;
        }
        try {
            return await withTimeout(minionModule.refreshCommunication(), this.COMMUNICATE_DEVICE_TIMEOUT.asMilliseconds());
        }
        catch (error) {
            if (typeof error.message === 'string' && error.message.indexOf('Promise not resolved after') !== -1) {
                throw {
                    responseCode: 1503,
                    message: 'communication with device fail, timeout',
                };
            }
            throw error;
        }
    }
    /**
     * Init any brand module in system.
     */
    initHandlers() {
        ////////////////////////////////////////////////////////////////////////
        //////////////// TO EXTEND: Init here new handler //////////////////////
        ////////////////////////////////////////////////////////////////////////
        this.initHandler(new mockHandler_1.MockHandler());
        this.initHandler(new tuyaHandler_1.TuyaHandler());
        this.initHandler(new tasmotaHandler_1.TasmotaHandler());
        this.initHandler(new broadlinkHandler_1.BroadlinkHandler());
        this.initHandler(new yeelightHandler_1.YeelightHandler());
        this.initHandler(new orviboHandler_1.OrviboHandler());
        this.initHandler(new iftttHandler_1.IftttHandler());
        this.initHandler(new miioHandler_1.MiioHandler());
        this.initHandler(new mqttHandler_1.MqttHandler());
    }
    /**
     * Hold the hendler instance and registar to minions status changed.
     * @param brandModule the handler instance.
     */
    initHandler(brandModule) {
        /**
         * Set pull proxy method to get all last minions array.
         */
        brandModule.retrieveMinions.setPullMethod(async () => {
            if (!this.retrieveMinions.isPullingAvailble) {
                return [];
            }
            return await this.retrieveMinions.pull();
        });
        brandModule.minionStatusChangedEvent.subscribe(changedMinionStatus => {
            this.minionStatusChangedEvent.next(changedMinionStatus);
        });
        this.modulesHandlers.push(brandModule);
    }
    /**
     * Get minion communcation module based on brand name.
     * @param brandName the brand name.
     * @returns The module instance or undefined if not exist.
     */
    getMinionModule(brandName) {
        for (const brandHandler of this.modulesHandlers) {
            if (brandName === brandHandler.brandName) {
                return brandHandler;
            }
        }
    }
    /**
     * Get DeviceKind of minoin device.
     * @param minionsBrandModuleBase The rand module to look in.
     * @param minionDevice the minoin device to get kind for.
     * @returns The device kind.
     */
    getModelKind(minionsBrandModuleBase, minionDevice) {
        for (const deviceKind of minionsBrandModuleBase.devices) {
            if (deviceKind.brand === minionDevice.brand && deviceKind.model === minionDevice.model) {
                return deviceKind;
            }
        }
    }
}
exports.ModulesManager = ModulesManager;
exports.ModulesManagerSingltone = new ModulesManager();
//# sourceMappingURL=modulesManager.js.map