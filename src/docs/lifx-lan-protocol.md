# LIFX LAN Protocol Reference

Source: lan.developer.lifx.com/docs

---

## LIFX Packets

### Introduction

> _Not yet pulled. Source: lan.developer.lifx.com/docs/introduction_

### What is in a LIFX message

> _Not yet pulled. Source: lan.developer.lifx.com/docs/what-is-in-a-lifx-message_

### Encoding a LIFX packet

> _Not yet pulled. Source: lan.developer.lifx.com/docs/encoding-a-lifx-packet_

### Decoding a LIFX packet

> _Not yet pulled. Source: lan.developer.lifx.com/docs/decoding-a-lifx-packet_

### Communicating with a device

> _Not yet pulled. Source: lan.developer.lifx.com/docs/communicating-with-a-device_

---

## Capabilities

### Our Products

> _Not yet pulled. Source: lan.developer.lifx.com/docs/our-products_

### Representing Color with HSBK

> _Not yet pulled. Source: lan.developer.lifx.com/docs/representing-color-with-hsbk_

### Waveforms

> _Not yet pulled. Source: lan.developer.lifx.com/docs/waveforms_

### Groups and Locations

> _Not yet pulled. Source: lan.developer.lifx.com/docs/groups-and-locations_

### Firmware Effects

> _Not yet pulled. Source: lan.developer.lifx.com/docs/firmware-effects_

### Infrared Light Control

> _Not yet pulled. Source: lan.developer.lifx.com/docs/infrared-light-control_

### HEV Light Control

> _Not yet pulled. Source: lan.developer.lifx.com/docs/hev-light-control_

### Lightstrip, String, Neon and Beam

> _Not yet pulled. Source: lan.developer.lifx.com/docs/lightstrip-string-neon-and-beam_

### Candle

> _Not yet pulled. Source: lan.developer.lifx.com/docs/candle_

### The LIFX Switch

> _Not yet pulled. Source: lan.developer.lifx.com/docs/the-lifx-switch_

### Tiles

> _Not yet pulled. Source: lan.developer.lifx.com/docs/tiles_

---

## Field Types

### Simple Types

| Type      | Size     | Description |
|-----------|----------|-------------|
| `Uint8`   | 1 byte   | Positive integer. |
| `Uint16`  | 2 bytes  | Positive integer. |
| `Uint32`  | 4 bytes  | Positive integer. |
| `Uint64`  | 8 bytes  | Positive integer. |
| `Int16`   | 2 bytes  | Signed (negative or positive) integer. |
| `Float`   | 4 bytes  | IEEE 754 float. |
| `Bytes`   | variable | Raw byte array. |
| `String`  | variable | NULL-terminated unicode string. |
| `Bool`    | 1 bit    | True or false. |
| `BoolInt` | 1 byte   | Integer where 0 = false, 1 = true. |
| `Reserved`| variable | Reserved for future use. Always set to 0. |

### Structures

#### Color

Represents a single HSBK value. Used in packets that set a different HSBK value per zone.

| Field        | Type     |
|--------------|----------|
| `hue`        | `Uint16` |
| `saturation` | `Uint16` |
| `brightness` | `Uint16` |
| `kelvin`     | `Uint16` |

#### Tile

Represents a single device in a chain. Used by StateDeviceChain (702).

| Field                    | Type     | Notes |
|--------------------------|----------|-------|
| `accel_meas_x`           | `Int16`  | See Tile Orientation. |
| `accel_meas_y`           | `Int16`  | See Tile Orientation. |
| `accel_meas_z`           | `Int16`  | See Tile Orientation. |
| `reserved6`              | 2 bytes  | Reserved. |
| `user_x`                 | `Float`  | See Tile Positions. |
| `user_y`                 | `Float`  | See Tile Positions. |
| `width`                  | `Uint8`  | Number of zones per row. |
| `height`                 | `Uint8`  | Number of zones per column. |
| `supported_frame_buffers`| `Uint8`  | Number of frame buffers supported. |
| `device_version_vendor`  | `Uint32` | Vendor id. See StateVersion (33). |
| `device_version_product` | `Uint32` | Product id. See StateVersion (33). |
| `reserved7`              | 4 bytes  | Reserved. |
| `firmware_build`         | `Uint64` | Firmware creation epoch. See StateHostFirmware (15). |
| `reserved8`              | 8 bytes  | Reserved. |
| `firmware_version_minor` | `Uint16` | Minor firmware version. See StateHostFirmware (15). |
| `firmware_version_major` | `Uint16` | Major firmware version. See StateHostFirmware (15). |
| `reserved9`              | 4 bytes  | Reserved. |

---

## Enums

### Services (`Uint8`)

| Value | Name         |
|-------|--------------|
| 1     | `UDP`        |
| 2     | `RESERVED1`  |
| 3     | `RESERVED2`  |
| 4     | `RESERVED3`  |
| 5     | `RESERVED4`  |

### Direction (`Uint8`)

| Value | Name           | Notes |
|-------|----------------|-------|
| 0     | `REVERSED`     | Moving towards zone 0. |
| 1     | `NOT_REVERSED` | Moving away from zone 0. |

### Waveform (`Uint8`)

| Value | Name         |
|-------|--------------|
| 0     | `SAW`        |
| 1     | `SINE`       |
| 2     | `HALF_SINE`  |
| 3     | `TRIANGLE`   |
| 4     | `PULSE`      |

### MultiZoneApplicationRequest (`Uint8`)

| Value | Name         |
|-------|--------------|
| 0     | `NO_APPLY`   |
| 1     | `APPLY`      |
| 2     | `APPLY_ONLY` |

### MultiZoneEffectType (`Uint8`)

| Value | Name        |
|-------|-------------|
| 0     | `OFF`       |
| 1     | `MOVE`      |
| 2     | `RESERVED1` |
| 3     | `RESERVED2` |

### MultiZoneExtendedApplicationRequest (`Uint8`)

| Value | Name         |
|-------|--------------|
| 0     | `NO_APPLY`   |
| 1     | `APPLY`      |
| 2     | `APPLY_ONLY` |

### TileEffectType (`Uint8`)

| Value | Name        |
|-------|-------------|
| 0     | `OFF`       |
| 1     | `RESERVED1` |
| 2     | `MORPH`     |
| 3     | `FLAME`     |
| 4     | `RESERVED2` |
| 5     | `SKY`       |

### TileEffectSkyType (`Uint8`)

| Value | Name      |
|-------|-----------|
| 0     | `SUNRISE` |
| 1     | `SUNSET`  |
| 2     | `CLOUDS`  |

### TileEffectSkyPalette (offsets, not an enum)

Reference offsets for the Sky Effect palette array:

| Index | Name         |
|-------|--------------|
| 0     | `SKY`        |
| 1     | `NIGHT_SKY`  |
| 2     | `DAWN_SKY`   |
| 3     | `DAWN_SUN`   |
| 4     | `FULL_SUN`   |
| 5     | `FINAL_SUN`  |

### LightLastHevCycleResult (`Uint8`)

| Value | Name                      |
|-------|---------------------------|
| 0     | `SUCCESS`                 |
| 1     | `BUSY`                    |
| 2     | `INTERRUPTED_BY_RESET`    |
| 3     | `INTERRUPTED_BY_HOMEKIT`  |
| 4     | `INTERRUPTED_BY_LAN`      |
| 5     | `INTERRUPTED_BY_CLOUD`    |
| 255   | `NONE`                    |
