import board
import adafruit_dht

dht = adafruit_dht.DHT22(board.D4, use_pulseio=False)


def get_dht_reading():
    try:
        temperature = dht.temperature
        humidity = dht.humidity

        if temperature is None or humidity is None:
            return None, None

        return round(temperature, 1), round(humidity, 1)

    except RuntimeError:
        return None, None
    except Exception as e:
        print(f"DHT error: {e}")
        return None, None