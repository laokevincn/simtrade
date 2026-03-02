import sys
import json
import threading
import queue
import math
import logging
from tqsdk import TqApi, TqAuth, TargetPosTask

# Suppress tqsdk logs from stdout to avoid breaking JSON parsing
logging.getLogger("tqsdk").setLevel(logging.WARNING)

TQ_USER = "18029559103"
TQ_PASS = "xbclaw@tqsdk"
SYMBOLS = ["KQ.m@SHFE.au", "KQ.m@INE.ec"]

cmd_queue = queue.Queue()

def read_stdin():
    for line in sys.stdin:
        try:
            cmd = json.loads(line)
            cmd_queue.put(cmd)
        except Exception:
            pass

def send_msg(msg):
    print(json.dumps(msg), flush=True)

def main():
    try:
        # Initialize TqApi with the provided simulated account
        api = TqApi(auth=TqAuth(TQ_USER, TQ_PASS))
        quotes = {sym: api.get_quote(sym) for sym in SYMBOLS}
        klines = {sym: api.get_kline_serial(sym, 60, data_length=100) for sym in SYMBOLS}
        account = api.get_account()
        
        # TargetPosTask automatically manages orders to reach the target volume
        target_pos = {sym: TargetPosTask(api, sym) for sym in SYMBOLS}

        # Start thread to listen for commands from Node.js
        t = threading.Thread(target=read_stdin, daemon=True)
        t.start()

        send_msg({"type": "ready", "symbols": SYMBOLS})

        while True:
            # Wait for data update from Tianqin servers
            api.wait_update()
            
            # Process commands from Node.js
            while not cmd_queue.empty():
                cmd = cmd_queue.get()
                if cmd['type'] == 'set_position':
                    sym = cmd['symbol']
                    if sym in target_pos:
                        target_pos[sym].set_target_volume(cmd['volume'])
            
            # Broadcast tick data
            for sym in SYMBOLS:
                quote = quotes[sym]
                if api.is_changing(quote, "last_price"):
                    send_msg({
                        "type": "tick",
                        "symbol": sym,
                        "price": quote.last_price,
                        "time": quote.datetime
                    })
                
                # Broadcast 1-minute kline data
                k_serial = klines[sym]
                if api.is_changing(k_serial.iloc[-1], "close") or api.is_changing(k_serial.iloc[-1], "high") or api.is_changing(k_serial.iloc[-1], "low"):
                    k = k_serial.iloc[-1]
                    if not math.isnan(k.close):
                        send_msg({
                            "type": "kline",
                            "symbol": sym,
                            "kline": {
                                "time": int(k.datetime / 1e9) if not math.isnan(k.datetime) else 0,
                                "open": k.open,
                                "high": k.high,
                                "low": k.low,
                                "close": k.close
                            }
                        })
                
            # Broadcast account balance
            if api.is_changing(account, "balance"):
                send_msg({
                    "type": "account",
                    "balance": account.balance
                })

    except Exception as e:
        send_msg({"type": "error", "message": str(e)})

if __name__ == "__main__":
    main()
