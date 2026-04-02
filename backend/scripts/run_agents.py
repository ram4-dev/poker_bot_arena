"""
Test agent runner: AlphaBot (agresivo) + BetaBot (pasivo).
Hace login, joinea Bronze arena, fuerza tick y juega en loop.
Uso: python backend/scripts/run_agents.py
"""
import urllib.request
import urllib.error
import json
import time
import threading

BASE = "http://localhost:8000"
MAX_HANDS = 10


def req(method, path, token=None, body=None, params=None):
    url = BASE + path
    if params:
        url += "?" + "&".join(f"{k}={v}" for k, v in params.items())
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(url, data=data, method=method)
    if token:
        r.add_header("Authorization", f"Bearer {token}")
    if body:
        r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r, timeout=10) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())
    except Exception as ex:
        return {"error": str(ex)}


def login(email, password):
    resp = req("POST", "/api/auth/login", body={"email": email, "password": password})
    token = resp.get("access_token")
    if not token:
        raise RuntimeError(f"Login failed for {email}: {resp}")
    agents = req("GET", "/api/agent/list", token=token)
    agent_id = agents["agents"][0]["id"]
    return token, agent_id


def get_bronze_arena(token):
    arenas = req("GET", "/api/arenas", token=token)
    for a in arenas.get("arenas", []):
        if a["slug"] == "bronze":
            return a["id"]
    raise RuntimeError("Bronze arena not found")


def play_loop(label, token, agent_id, stop_event, max_hands=MAX_HANDS):
    hands_played = 0
    last_hand_id = None
    for i in range(500):
        if stop_event.is_set():
            break
        state = req("GET", "/api/game/state", token=token, params={"agent_id": agent_id})
        status = state.get("status", "unknown")
        gs = state.get("game_state") or {}

        if status in ("queued", "waiting"):
            if i % 8 == 0:
                print(f"[{label}:{i}] {status}...", flush=True)
            time.sleep(1)
            continue

        if status == "idle" and hands_played > 0:
            print(f"[{label}] idle — {hands_played} manos jugadas. Listo.", flush=True)
            break

        if status == "your_turn" and gs:
            hand_id = gs.get("hand_id", "")
            current_bet = gs.get("current_bet", 0)
            min_raise = gs.get("min_raise", 0)
            my_stack = gs.get("my_stack", 0)

            if hand_id and hand_id != last_hand_id:
                hands_played += 1
                last_hand_id = hand_id
                hole = gs.get("hole_cards", [])
                community = gs.get("community_cards", [])
                print(f"[{label}] --- MANO #{hands_played} | cartas={hole} mesa={community} ---", flush=True)

            # AlphaBot: raise siempre que puede; BetaBot: check/call pasivo
            if label == "Alpha":
                if current_bet == 0:
                    action, amount = "check", 0
                else:
                    raise_to = current_bet + min_raise + current_bet
                    if my_stack >= raise_to:
                        action, amount = "raise", raise_to
                    else:
                        action, amount = "call", 0
            else:  # Beta
                action, amount = ("check", 0) if current_bet == 0 else ("call", 0)

            r = req("POST", "/api/game/action", token=token,
                    body={"agent_id": agent_id, "hand_id": hand_id, "action": action, "amount": amount})
            if "error" in r or r.get("status") == "error" or "detail" in r:
                r = req("POST", "/api/game/action", token=token,
                        body={"agent_id": agent_id, "hand_id": hand_id, "action": "call", "amount": 0})
                action = "call(fb)"
            print(f"[{label}:{i}] {action}({amount}) → hc={r.get('hand_complete', '?')}", flush=True)

            if hands_played >= max_hands:
                print(f"[{label}] {max_hands} manos completadas. Terminando.", flush=True)
                break

        time.sleep(1.5)

    stop_event.set()


def main():
    print("=== Bot Arena — Test Agents ===\n", flush=True)

    print("Logueando agentes...", flush=True)
    alpha_token, alpha_id = login("agent_alpha@test.com", "alpha1234")
    beta_token, beta_id = login("agent_beta@test.com", "beta1234")
    print(f"AlphaBot ID: {alpha_id}", flush=True)
    print(f"BetaBot  ID: {beta_id}", flush=True)

    arena_id = get_bronze_arena(alpha_token)
    print(f"Bronze arena ID: {arena_id}\n", flush=True)

    print("[Alpha] Joineando arena...", flush=True)
    print(req("POST", "/api/arena/join", token=alpha_token,
              body={"agent_id": alpha_id, "arena_id": arena_id}), flush=True)

    time.sleep(2)

    print("[Beta] Joineando arena...", flush=True)
    print(req("POST", "/api/arena/join", token=beta_token,
              body={"agent_id": beta_id, "arena_id": arena_id}), flush=True)

    print("\n[Admin] Tick...", flush=True)
    print(req("POST", "/api/admin/tick"), flush=True)

    time.sleep(1)

    stop = threading.Event()
    t_alpha = threading.Thread(target=play_loop, args=("Alpha", alpha_token, alpha_id, stop), daemon=True)
    t_beta  = threading.Thread(target=play_loop, args=("Beta",  beta_token,  beta_id,  stop), daemon=True)

    t_alpha.start()
    t_beta.start()
    t_alpha.join()
    t_beta.join()

    print("\n[Alpha] Saliendo...", flush=True)
    print(req("POST", "/api/game/leave", token=alpha_token, body={"agent_id": alpha_id}), flush=True)
    print("[Beta] Saliendo...", flush=True)
    print(req("POST", "/api/game/leave", token=beta_token, body={"agent_id": beta_id}), flush=True)

    print("\n=== Test agents terminados ===", flush=True)


if __name__ == "__main__":
    main()
