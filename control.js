// Define the IDs for the humidity sensors
const bathroomHumidityId = "hmip.0.devices.3014F711A0003920C99F256A.channels.1.humidity";
const room1HumidityId = "hmip.0.devices.3014F711A0003920C99F243F.channels.1.humidity";
const room2HumidityId = "hmip.0.devices.3014F711A0003920C99F2489.channels.1.humidity";

// Define the ID for the fan switch
const fanSwitchId = "shelly.0.shellyplus2pm#e86beae945a1.Relay0.Switch";

// Define the override state ID and humidity threshold state ID
const overrideStateId = "0_userdata.0.bathroomFanOverride";
const humidityThresholdId = "0_userdata.0.humidityThreshold";

// Initialize the override state
if (!existsState(overrideStateId)) {
    createState(overrideStateId, false, {
        type: "boolean",
        read: true,
        write: true,
        role: "switch",
        desc: "Manual override for the bathroom fan"
    });
}

// Initialize the humidity threshold state
if (!existsState(humidityThresholdId)) {
    createState(humidityThresholdId, 60, {
        type: "number",
        read: true,
        write: true,
        role: "value",
        desc: "Humidity threshold for activating the fan"
    });
}

let enableThroughOverrideTimer = null;
let disableAutoTimer = null;

// Modify controlFanBasedOnHumidity to check disableAutoTimer
function controlFanBasedOnHumidity() {
    if (disableAutoTimer) return; // Exit if automatic control is disabled

    const bathroomHumidity = getState(bathroomHumidityId).val;
    const room1Humidity = getState(room1HumidityId).val;
    const room2Humidity = getState(room2HumidityId).val;
    const averageRoomHumidity = (room1Humidity + room2Humidity) / 2;
    const humidityThreshold = getState(humidityThresholdId).val;

    let fanShouldRun = bathroomHumidity > humidityThreshold || bathroomHumidity > averageRoomHumidity + 10;

    setState(fanSwitchId, fanShouldRun);
    // Acknowledge the override state as false when automatically controlling the fan
    setState(overrideStateId, false, true); // Use ack = true to indicate this is an automatic update
}

// Function to handle override changes
function handleOverrideChange(obj) {
    if (obj.state.ack) return; // Ignore state changes with ack = true (i.e., changes made by this script

    const newValue = obj.state.val;
    const oldValue = obj.oldState.val;

    // Transition from false to true
    if (!oldValue && newValue) {
        // Cancel any existing enableThroughOverrideTimer
        if (enableThroughOverrideTimer) {
            clearTimeout(enableThroughOverrideTimer);
            enableThroughOverrideTimer = null;
        }
        // Turn on the fan and set a timer to turn it off after 20 minutes
        setState(fanSwitchId, true);
        enableThroughOverrideTimer = setTimeout(() => {
            setState(fanSwitchId, false);
            setState(overrideStateId, false, true); // Reset override after action is complete, with ack = true
        }, 20 * 60 * 1000); // 20 minutes
    } else if (oldValue && !newValue) {
        // Transition from true to false, stop the fan if it was started by override
        if (enableThroughOverrideTimer) {
            clearTimeout(enableThroughOverrideTimer);
            enableThroughOverrideTimer = null;
        }
        // Immediately turn off the fan
        setState(fanSwitchId, false);
        // Start disableAutoTimer to disable automatic control for 6 hours
        if (disableAutoTimer) {
            clearTimeout(disableAutoTimer); // Clear any existing timer
        }
        disableAutoTimer = setTimeout(() => {
            disableAutoTimer = null; // Re-enable automatic control after 6 hours
        }, 6 * 60 * 60 * 1000); // 6 hours
    }
}

// Listen for changes to the override state and humidity threshold
on({id: overrideStateId, change: "ne"}, handleOverrideChange);
on({id: humidityThresholdId, change: "any"}, controlFanBasedOnHumidity);

// Listen for changes to the humidity sensors and control the fan based on humidity
on({id: bathroomHumidityId, change: "any"}, controlFanBasedOnHumidity);
on({id: room1HumidityId, change: "any"}, controlFanBasedOnHumidity);
on({id: room2HumidityId, change: "any"}, controlFanBasedOnHumidity);
