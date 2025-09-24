//RRA

export type VirtualSensor = {
  id: string;
  name: string;
  temperature: number;
};

const sensors: VirtualSensor[] = [
  { id: "sensor-1", name: "Room 101", temperature: 22 },
  { id: "sensor-2", name: "Room 102", temperature: 22 },
];

export function getSensors() {
  return sensors;
}

// Эмулируем изменение температуры каждую секунду
setInterval(() => {
  sensors.forEach(sensor => {
    // Случайное изменение температуры
    const delta = (Math.random() - 0.5) * 0.5;
    sensor.temperature = Math.round((sensor.temperature + delta) * 10) / 10;
  });
}, 1000);