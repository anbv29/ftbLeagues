import { MatchListPage } from "./components/MatchListPage";
import { MatchRoomPage } from "./components/MatchRoomPage";
import { useHashRoute } from "./lib/useHashRoute";

export default function App() {
  const route = useHashRoute();

  if (route.view === "match") {
    return (
      <MatchRoomPage
        key={route.matchId}
        matchId={route.matchId}
        roomCode={route.roomCode}
      />
    );
  }

  return <MatchListPage />;
}
