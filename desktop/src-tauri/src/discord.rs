//! Discord Rich Presence via the local Discord IPC (discord-rich-presence crate).
use discord_rich_presence::{
    activity::{Activity, ActivityType, Assets, Timestamps},
    DiscordIpc, DiscordIpcClient,
};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

const CLIENT_ID: &str = "1384584152233545789";

static CLIENT: OnceLock<Mutex<Option<DiscordIpcClient>>> = OnceLock::new();

fn client_slot() -> &'static Mutex<Option<DiscordIpcClient>> {
    CLIENT.get_or_init(|| Mutex::new(None))
}

fn clean_text(value: &str) -> String {
    value
        .chars()
        .map(|c| {
            if c.is_control() || c == '\n' || c == '\r' {
                ' '
            } else {
                c
            }
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(128)
        .collect()
}

fn clean_or(value: Option<&str>, fallback: &str) -> String {
    let t = clean_text(value.unwrap_or(""));
    if t.is_empty() {
        fallback.to_string()
    } else {
        t
    }
}

fn ensure_connected(slot: &mut Option<DiscordIpcClient>) -> Result<&mut DiscordIpcClient, String> {
    if slot.is_none() {
        let mut client = DiscordIpcClient::new(CLIENT_ID);
        client
            .connect()
            .map_err(|e| format!("discord connect: {e}"))?;
        *slot = Some(client);
    }
    Ok(slot.as_mut().expect("just connected"))
}

fn drop_client(slot: &mut Option<DiscordIpcClient>) {
    if let Some(mut old) = slot.take() {
        let _ = old.close();
    }
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackPresence {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub duration: Option<f64>,
    pub position: Option<f64>,
    pub is_playing: Option<bool>,
    pub thumbnail: Option<String>,
    #[allow(dead_code)]
    pub url: Option<String>,
}

fn build_activity<'a>(
    title: &'a str,
    artist: &'a str,
    is_playing: bool,
    position: f64,
    duration: f64,
    thumbnail: &'a str,
    with_art: bool,
) -> Activity<'a> {
    // type Listening → Discord shows "Listening to {name}". Without name it falls back to the
    // Developer Portal app title (still "Muriel" until that app is renamed to Dusk).
    let mut act = Activity::new()
        .activity_type(ActivityType::Listening)
        .name(title)
        .details(title)
        .state(artist);

    if is_playing {
        let start = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0)
            - position.floor() as i64;
        let mut ts = Timestamps::new().start(start);
        if duration > 0.0 {
            ts = ts.end(start + duration.floor() as i64);
        }
        act = act.timestamps(ts);
    }

    if with_art && thumbnail.starts_with("https://") && !thumbnail.contains("127.0.0.1") {
        act = act.assets(Assets::new().large_image(thumbnail));
    }
    act
}

pub fn set_presence(track: TrackPresence) -> Result<(), String> {
    let title = clean_or(track.title.as_deref(), "Unknown Track");
    let artist = clean_or(track.artist.as_deref(), "Unknown Artist");
    let is_playing = track.is_playing.unwrap_or(false);
    let position = track.position.unwrap_or(0.0).max(0.0);
    let duration = track.duration.unwrap_or(0.0);
    let thumbnail = track.thumbnail.unwrap_or_default();

    let mut guard = client_slot()
        .lock()
        .map_err(|_| "discord lock poisoned".to_string())?;

    let mut last_err = String::new();
    for (reconnect, with_art) in [(false, true), (true, true), (true, false)] {
        if reconnect {
            drop_client(&mut guard);
        }
        match ensure_connected(&mut guard) {
            Ok(client) => {
                let act = build_activity(
                    &title,
                    &artist,
                    is_playing,
                    position,
                    duration,
                    &thumbnail,
                    with_art,
                );
                match client.set_activity(act) {
                    Ok(()) => return Ok(()),
                    Err(e) => {
                        last_err = format!("discord set: {e}");
                        drop_client(&mut guard);
                    }
                }
            }
            Err(e) => last_err = e,
        }
    }
    Err(last_err)
}

pub fn clear_presence() -> Result<(), String> {
    let mut guard = client_slot()
        .lock()
        .map_err(|_| "discord lock poisoned".to_string())?;
    let Some(client) = guard.as_mut() else {
        return Ok(());
    };
    match client.clear_activity() {
        Ok(()) => Ok(()),
        Err(e) => {
            drop_client(&mut guard);
            Err(format!("discord clear: {e}"))
        }
    }
}
