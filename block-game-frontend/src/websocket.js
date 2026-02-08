import { Client } from "@stomp/stompjs";

export const createClient = () => {
  return new Client({
    brokerURL: "ws://localhost:8099/ws",
    reconnectDelay: 5000,
  });
};
