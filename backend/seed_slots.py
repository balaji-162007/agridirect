from database import SessionLocal, engine
import models

def seed_slots():
    db = SessionLocal()
    try:
        # Check if slots exist
        count = db.query(models.DeliverySlot).count()
        if count > 0:
            print("Slots already seeded.")
            return

        slots = [
            models.DeliverySlot(name="Morning",   start_time="07:00", end_time="10:00", max_orders=50),
            models.DeliverySlot(name="Afternoon", start_time="12:00", end_time="15:00", max_orders=30),
            models.DeliverySlot(name="Evening",   start_time="17:00", end_time="20:00", max_orders=40),
        ]
        db.add_all(slots)
        db.commit()
        print("Successfully seeded 3 delivery slots.")
    except Exception as e:
        print(f"Error seeding slots: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    # Create tables if not exist (though they should be)
    models.Base.metadata.create_all(bind=engine)
    seed_slots()
