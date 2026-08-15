import os
import tempfile
import unittest

from PIL import Image, ImageDraw

from measure import measure


class MeasureTests(unittest.TestCase):
    def test_measure_reports_subject_occupancy_and_margins(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "subject.png")
            image = Image.new("RGB", (10, 10), "white")
            ImageDraw.Draw(image).rectangle((2, 1, 7, 8), fill="black")
            image.save(path)

            result = measure(path)

        self.assertIsNotNone(result)
        self.assertEqual(result["dimensions"], "10x10")
        self.assertEqual(result["ocup_v"], 80)
        self.assertEqual(result["ocup_h"], 60)
        self.assertEqual(result["top"], 10)
        self.assertEqual(result["bottom"], 10)
        self.assertEqual(result["left"], 20)
        self.assertEqual(result["right"], 20)


if __name__ == "__main__":
    unittest.main()
