"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const moment = require("moment");
const randomstring = require("randomstring");
const rxjs_1 = require("rxjs");
const minionsDal_1 = require("../data-layer/minionsDal");
const modulesManager_1 = require("../modules/modulesManager");
const deepCopy_1 = require("../utilities/deepCopy");
const logger_1 = require("../utilities/logger");
const sleep_1 = require("../utilities/sleep");
const devicesBl_1 = require("./devicesBl");
class MinionsBl {
    /**
     * Init minions bl. using dependency injection pattern to allow units testings.
     * @param minionsDal Inject the dal instance.
     */
    constructor(minionsDal, devicesBl, modulesManager) {
        /**
         * Minions status update feed.
         */
        this.minionFeed = new rxjs_1.BehaviorSubject(undefined);
        this.scanningStatus = 'finished';
        /**
         * minions
         */
        this.minions = [];
        this.minionsDal = minionsDal;
        this.devicesBl = devicesBl;
        this.modulesManager = modulesManager;
        logger_1.logger.info('Starting init minions....');
        this.initData()
            .then(() => {
            logger_1.logger.info('Init minions done');
        })
            .catch(() => {
            logger_1.logger.error('Init minions fail');
        });
    }
    /**
     * API
     */
    /**
     * Gets minions array.
     */
    async getMinions() {
        return this.minions;
    }
    /**
     * Get minion by id.
     * @param minionId minion id.
     */
    async getMinionById(minionId) {
        const minion = this.findMinion(minionId);
        if (!minion) {
            throw {
                responseCode: 1404,
                message: 'minion not exist',
            };
        }
        return minion;
    }
    /**
     * Scan all minions real status.
     * mean, update minions cache by request each device what is the real status.
     * @param scanNetwork Whenever scan also the local networks IP's map or not.
     */
    async scanMinionsStatus(scanNetwork = false) {
        if (this.scanningStatus !== 'inProgress') {
            this.scanMinioinsNetworkAndStatuses(scanNetwork);
        }
    }
    /**
     * Get the current scanning status
     */
    getScaningStatus() {
        return this.scanningStatus;
    }
    /**
     * Scan minion real status.
     * mean update minions cache by request the device what is the real status.
     */
    async scanMinionStatus(minionId) {
        const minion = this.findMinion(minionId);
        if (!minion) {
            throw {
                responseCode: 1404,
                message: 'minion not exist',
            };
        }
        await this.readMinionStatus(minion);
    }
    /**
     * Rename minion.
     * @param minionId minion id.
     * @param nameToSet the new name to set.
     */
    async renameMinion(minionId, nameToSet) {
        const minion = this.findMinion(minionId);
        if (!minion) {
            throw {
                responseCode: 1404,
                message: 'minion not exist',
            };
        }
        minion.name = nameToSet;
        try {
            await this.minionsDal.renameMinion(minionId, nameToSet);
        }
        catch (error) {
            logger_1.logger.warn(`Fail to update minion ${minionId} with new name ${error.message}`);
        }
        /**
         * Send minions feed update.
         */
        this.minionFeed.next({
            event: 'update',
            minion,
        });
    }
    /**
     * Set minion room.
     * @param minionId minion id.
     * @param nameToSet the new room name to set.
     */
    async setMinionRoom(minionId, nameToSet) {
        const minion = this.findMinion(minionId);
        if (!minion) {
            throw {
                responseCode: 1404,
                message: 'minion not exist',
            };
        }
        minion.room = nameToSet;
        try {
            await this.minionsDal.setMinionRoom(minionId, nameToSet);
        }
        catch (error) {
            logger_1.logger.warn(`Fail to update room of minion ${minionId} with new name ${error.message}`);
        }
        /**
         * Send minions feed update.
         */
        this.minionFeed.next({
            event: 'update',
            minion,
        });
    }
    /**
     * Set minion status
     * @param minionId minion to set new status to.
     * @param minionStatus the status to set.
     */
    async setMinionStatus(minionId, minionStatus) {
        const minion = this.findMinion(minionId);
        if (!minion) {
            throw {
                responseCode: 1404,
                message: 'minion not exist',
            };
        }
        /**
         * The minion status is depend on minion type.
         */
        if (!minionStatus[minion.minionType]) {
            throw {
                responseCode: 1405,
                message: 'incorrect minion status for current minion type',
            };
        }
        /**
         * set the status.
         */
        await this.modulesManager.setStatus(minion, minionStatus).catch(err => {
            minion.isProperlyCommunicated = false;
            this.minionFeed.next({
                event: 'update',
                minion,
            });
            throw err;
        });
        /** If there is no change from the last minion status */
        if (minion.isProperlyCommunicated && JSON.stringify(minion.minionStatus) === JSON.stringify(minionStatus)) {
            return;
        }
        minion.isProperlyCommunicated = true;
        /**
         * If success, update minion to new status.
         */
        minion.minionStatus = minionStatus;
        /**
         * Send minions feed update.
         */
        this.minionFeed.next({
            event: 'update',
            minion,
        });
    }
    /**
     * Set minion timeout property.
     */
    async setMinionTimeout(minionId, setAutoTurnOffMS) {
        const minion = this.findMinion(minionId);
        if (!minion) {
            throw {
                responseCode: 1404,
                message: 'minion not exist',
            };
        }
        minion.minionAutoTurnOffMS = setAutoTurnOffMS;
        /**
         * Save timeout update in Dal for next app running.
         */
        this.minionsDal.updateMinionAutoTurnOff(minionId, setAutoTurnOffMS).catch((error) => {
            logger_1.logger.warn(`Fail to update minion ${minionId} auto turn off ${error.message}`);
        });
        /**
         * Send minion feed update
         */
        this.minionFeed.next({
            event: 'update',
            minion,
        });
    }
    /**
     * Set minion calibrate property.
     */
    async setMinionCalibrate(minionId, calibrationCycleMinutes) {
        const minion = this.findMinion(minionId);
        if (!minion) {
            throw {
                responseCode: 1404,
                message: 'minion not exist',
            };
        }
        minion.calibrationCycleMinutes = calibrationCycleMinutes;
        /**
         * Save timeout update in Dal for next app running.
         */
        this.minionsDal.updateMinionCalibrate(minionId, calibrationCycleMinutes).catch((error) => {
            logger_1.logger.warn(`Fail to update minion ${minionId} auto turn off ${error.message}`);
        });
        /**
         * Send minion feed update
         */
        this.minionFeed.next({
            event: 'update',
            minion,
        });
    }
    /**
     * Set all minions status off.
     */
    async powerAllOff() {
        logger_1.logger.info(`Setting all minions power off ...`);
        for (const minion of this.minions) {
            try {
                const statusToSet = deepCopy_1.DeepCopy(minion.minionStatus);
                statusToSet[minion.minionType].status = 'off';
                await this.setMinionStatus(minion.minionId, statusToSet);
            }
            catch (error) {
                logger_1.logger.warn(`Set minion ${minion.minionId} power off failed, ${error ? error.message : 'unknown'}`);
            }
        }
    }
    /**
     * Create new minion
     * @param minion minion to create.
     */
    async createMinion(minion) {
        /**
         * check if minion valid.
         */
        const error = this.validateNewMinion(minion);
        if (error) {
            throw error;
        }
        /**
         * get local devices (to load current physical info such as ip)
         */
        const localDevices = await this.devicesBl.getDevices();
        let foundLocalDevice = false;
        for (const localDevice of localDevices) {
            if (localDevice.mac === minion.device.pysicalDevice.mac) {
                minion.device.pysicalDevice = localDevice;
                foundLocalDevice = true;
                break;
            }
        }
        if (!foundLocalDevice) {
            throw {
                responseCode: 2404,
                message: 'device not exist in lan network',
            };
        }
        /**
         * Generate new id. (never trust client....)
         */
        minion.minionId = randomstring.generate(6);
        /**
         * Create new minion in dal.
         */
        await this.minionsDal.createMinion(minion);
        /**
         * Send create new minion feed update (*before* try to get the status!!!)
         */
        this.minionFeed.next({
            event: 'created',
            minion,
        });
        /**
         * Try to get current status.
         */
        try {
            await this.readMinionStatus(minion);
        }
        catch (error) { }
    }
    /**
     * Delete minion
     * @param minionId minion id to delete
     */
    async deleteMinion(minionId) {
        const originalMinion = this.findMinion(minionId);
        if (!originalMinion) {
            throw {
                responseCode: 1404,
                message: 'minion not exist',
            };
        }
        await this.minionsDal.deleteMinion(originalMinion);
        // The minions array is given from DAL by ref, mean if removed
        // from dal it will removed from BL too, so check if exist
        // (if in next someone will copy by val) and then remove.
        if (this.minions.indexOf(originalMinion) !== -1) {
            this.minions.splice(this.minions.indexOf(originalMinion), 1);
        }
        this.minionFeed.next({
            event: 'removed',
            minion: originalMinion,
        });
        // Finally clean module communication
        await this.modulesManager.refreshModule(originalMinion.device.brand);
    }
    /**
     * Notify minion status changed by ifttt
     * @param minionId Minion id.
     * @param iftttOnChanged Minion key amd status to set.
     */
    async notifyMinionChangedByIfttt(minionId, iftttOnChanged) {
        const minion = this.findMinion(minionId);
        if (!minion) {
            throw {
                responseCode: 1404,
                message: 'minion not exist',
            };
        }
        /** Make sure the deviceId match to minion deviceId (there is no other authentication!!!) */
        if (iftttOnChanged.deviceId !== minion.device.deviceId) {
            throw {
                responseCode: 5403,
                message: 'invalid device id',
            };
        }
        /** Case it's first time update. */
        if (!minion.minionStatus[minion.minionType]) {
            const initStatus = {
                status: 'on',
            };
            const initMinionStatus = {};
            initMinionStatus[minion.minionType] = initStatus;
            minion.minionStatus = initMinionStatus;
        }
        /** Update the minion status */
        minion.minionStatus[minion.minionType].status = iftttOnChanged.newStatus;
        /**
         * Send minions feed update.
         */
        this.minionFeed.next({
            event: 'update',
            minion,
        });
    }
    /**
     * Init minions.
     */
    async initData() {
        /** Mark scanning as 'inProgress' */
        this.scanningStatus = 'inProgress';
        /**
         * Gets all minions
         */
        this.minions = await this.minionsDal.getMinions();
        /**
         * Scan network on startup
         */
        await this.devicesBl.rescanNetwork();
        /**
         * Get network local devices
         */
        const localDevices = await this.devicesBl.getDevices();
        /**
         * Then load minion with new physical network data
         */
        await this.loadMinionsLocalDeviceData(localDevices);
        /**
         * Let`s modules retrieve updated minions array.
         */
        modulesManager_1.ModulesManagerSingltone.retrieveMinions.setPullMethod(async () => {
            return await this.getMinions();
        });
        /**
         * After all, subscribe to devices status updates.
         */
        this.modulesManager.minionStatusChangedEvent.subscribe(async (pysicalDeviceUpdate) => {
            if (!pysicalDeviceUpdate) {
                return;
            }
            try {
                const minion = await this.getMinionById(pysicalDeviceUpdate.minionId);
                await this.onMinionUpdated(minion, pysicalDeviceUpdate.status);
            }
            catch (error) {
                logger_1.logger.info(`Avoiding device update, there is no minion with id: ${pysicalDeviceUpdate.minionId}`);
            }
        });
        /**
         * And also register to devices pysical data update (name or ip).
         */
        this.devicesBl.devicesUpdate.subscribe((localsDevices) => {
            this.loadMinionsLocalDeviceData(localsDevices);
        });
        /**
         * Finally, after all, get minions status.
         */
        await this.readMinionsStatus();
        /** Now mark all tasks finished */
        this.scanningStatus = 'finished';
    }
    /**
     * Load minion devices data
     * @param localDevices local device array.
     */
    async loadMinionsLocalDeviceData(localDevices) {
        /**
         * Each device check each used minion.
         */
        for (const localDevice of localDevices) {
            for (const minion of this.minions) {
                if (minion.device.pysicalDevice.mac === localDevice.mac) {
                    minion.device.pysicalDevice = localDevice;
                }
            }
        }
    }
    /**
     * Read minoin current status.
     * @param minion minion to read status for.
     */
    async readMinionStatus(minion) {
        try {
            const currentStatus = (await this.modulesManager.getStatus(minion));
            await this.onMinionUpdated(minion, currentStatus);
        }
        catch (error) {
            minion.isProperlyCommunicated = false;
            logger_1.logger.warn(`Fail to read status of ${minion.name} id: ${minion.minionId} err : ${error.message}`);
            throw error;
        }
    }
    /**
     * Read each minion current status.
     */
    async readMinionsStatus() {
        for (const minion of this.minions) {
            /**
             * Read current minion status.
             */
            await this.readMinionStatus(minion).catch(() => {
                /**
                 * Fail, do nothing....
                 */
            });
            /**
             * Let time between minions reading.
             * this is because some of devices using broadcast in network and can't communication 2 together.
             */
            await sleep_1.Delay(moment.duration(1, 'seconds'));
        }
    }
    /**
     * Find minion in minions array.
     * @param minionId minioin id.
     */
    findMinion(minionId) {
        for (const minion of this.minions) {
            if (minion.minionId === minionId) {
                return minion;
            }
        }
    }
    async onMinionUpdated(minion, updateToStatus) {
        /** If there is no change from last minion status */
        if (minion.isProperlyCommunicated && JSON.stringify(minion.minionStatus) === JSON.stringify(updateToStatus)) {
            return;
        }
        minion.isProperlyCommunicated = true;
        minion.minionStatus = updateToStatus;
        this.minionFeed.next({
            event: 'update',
            minion,
        });
    }
    /**
     * Validate new minion properties to make sure that they compatible to requires.
     * @param minionToCheck new minion to validate.
     */
    validateNewMinion(minionToCheck) {
        /**
         * Get brand & model
         */
        let deviceKind;
        for (const kind of this.modulesManager.devicesKind) {
            if (kind.brand === minionToCheck.device.brand && kind.model === minionToCheck.device.model) {
                deviceKind = kind;
            }
        }
        /**
         * Check that model exits in barns.
         */
        if (!deviceKind) {
            return {
                responseCode: 1409,
                message: 'there is no supported model for brand + model',
            };
        }
        /**
         * Check if token reqired and not exist.
         */
        if (deviceKind.isTokenRequierd && !minionToCheck.device.token) {
            return {
                responseCode: 2409,
                message: 'token is requird',
            };
        }
        /**
         * Check if id reqired and not exist.
         */
        if (deviceKind.isIdRequierd && !minionToCheck.device.deviceId) {
            return {
                responseCode: 3409,
                message: 'id is requird',
            };
        }
        /**
         * If the modele is not for unlimited minoins count the used minions.
         */
        if (deviceKind.minionsPerDevice !== -1) {
            let minionsCount = 0;
            for (const minion of this.minions) {
                if (minion.device.pysicalDevice.mac === minionToCheck.device.pysicalDevice.mac) {
                    minionsCount++;
                }
            }
            /**
             * If the new minion is above max minions per device.
             */
            if (minionsCount >= deviceKind.minionsPerDevice) {
                return {
                    responseCode: 4409,
                    message: 'device already in max uses with other minion',
                };
            }
        }
        /**
         * ignore user selection and set corrent minion type based on model.
         */
        minionToCheck.minionType = deviceKind.suppotedMinionType;
    }
    /**
     * Scan the minions current status
     * @param scanNetwork Whenever scan also the local networks IP's map or not.
     */
    async scanMinioinsNetworkAndStatuses(scanNetwork = false) {
        this.scanningStatus = 'inProgress';
        try {
            if (scanNetwork) {
                await this.devicesBl.rescanNetwork();
            }
            await this.modulesManager.refreshModules();
            await this.readMinionsStatus();
        }
        catch (error) {
            logger_1.logger.warn(`Scannig minions ${scanNetwork ? 'with network' : ''} faild ${JSON.stringify(error)}`);
            this.scanningStatus = 'fail';
            return;
        }
        this.scanningStatus = 'finished';
    }
}
exports.MinionsBl = MinionsBl;
exports.MinionsBlSingleton = new MinionsBl(minionsDal_1.MinionsDalSingleton, devicesBl_1.DevicesBlSingleton, modulesManager_1.ModulesManagerSingltone);
//# sourceMappingURL=minionsBl.js.map